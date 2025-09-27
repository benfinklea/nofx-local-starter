/**
 * API Key service - extracted API key management logic
 */

import { Request } from 'express';
import { createServiceClient, createAuditLog } from '../../../auth/supabase';
import { log } from '../../../lib/logger';
import crypto from 'crypto';
import type { ApiKeyCreateData } from './types';

export class ApiKeyService {
  private async getServiceClient() {
    const supabase = createServiceClient();
    if (!supabase) {
      throw new Error('Service unavailable');
    }
    return supabase;
  }

  private generateApiKey(): string {
    return 'nofx_' + crypto.randomBytes(32).toString('hex');
  }

  private validatePermissions(permissions: string[]): void {
    const validPermissions = ['read', 'write', 'delete', 'admin'];
    const invalidPerms = permissions.filter(p => !validPermissions.includes(p));

    if (invalidPerms.length > 0) {
      throw new Error(`Invalid permissions: ${invalidPerms.join(', ')}`);
    }
  }

  async createApiKey(keyData: ApiKeyCreateData, userId: string, req: Request) {
    const supabase = await this.getServiceClient();
    const { name, permissions } = keyData;

    // Validate permissions
    this.validatePermissions(permissions);

    // Generate API key
    const apiKey = this.generateApiKey();
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Check for existing API key with same name
    const { data: existingKey } = await supabase
      .from('api_keys')
      .select('id')
      .eq('user_id', userId)
      .eq('name', name)
      .single();

    if (existingKey) {
      throw new Error('API key with this name already exists');
    }

    // Insert API key
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        name,
        key_hash: keyHash,
        permissions,
        created_at: new Date().toISOString(),
        last_used_at: null,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      log.error({ error, userId }, 'Failed to create API key');
      throw new Error('Failed to create API key');
    }

    // Create audit log
    await createAuditLog(userId, 'api_key.created', 'api_key', data.id, {
      name,
      permissions
    }, req);

    return {
      id: data.id,
      name: data.name,
      key: apiKey, // Only return the actual key once, during creation
      permissions: data.permissions,
      created_at: data.created_at
    };
  }

  async listApiKeys(userId: string) {
    const supabase = await this.getServiceClient();

    const { data, error } = await supabase
      .from('api_keys')
      .select(`
        id,
        name,
        permissions,
        created_at,
        last_used_at,
        is_active
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      log.error({ error, userId }, 'Failed to list API keys');
      throw new Error('Failed to retrieve API keys');
    }

    return data || [];
  }

  async deleteApiKey(keyId: string, userId: string, req: Request) {
    const supabase = await this.getServiceClient();

    // Verify the key belongs to the user
    const { data: existingKey, error: checkError } = await supabase
      .from('api_keys')
      .select('id, name')
      .eq('id', keyId)
      .eq('user_id', userId)
      .single();

    if (checkError || !existingKey) {
      throw new Error('API key not found');
    }

    // Soft delete by marking as inactive
    const { error } = await supabase
      .from('api_keys')
      .update({
        is_active: false,
        deleted_at: new Date().toISOString()
      })
      .eq('id', keyId)
      .eq('user_id', userId);

    if (error) {
      log.error({ error, userId, keyId }, 'Failed to delete API key');
      throw new Error('Failed to delete API key');
    }

    // Create audit log
    await createAuditLog(userId, 'api_key.deleted', 'api_key', keyId, {
      name: existingKey.name
    }, req);
  }

  async validateApiKey(apiKey: string) {
    if (!apiKey || !apiKey.startsWith('nofx_')) {
      return null;
    }

    const supabase = await this.getServiceClient();
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const { data, error } = await supabase
      .from('api_keys')
      .select(`
        id,
        user_id,
        name,
        permissions,
        user:users (
          id,
          email,
          full_name
        )
      `)
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    // Update last used timestamp
    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id);

    return {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      permissions: data.permissions,
      user: data.user
    };
  }
}