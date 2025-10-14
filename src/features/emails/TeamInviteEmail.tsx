import React from 'react';
import {
  Button,
  Heading,
  Link,
  Section,
  Text,
} from '@react-email/components';
import { BaseEmailTemplate } from './components/BaseEmailTemplate';

interface TeamInviteEmailProps {
  teamName: string;
  inviterName: string;
  inviteeName: string;
  role: 'admin' | 'member' | 'viewer';
  message?: string;
  acceptUrl: string;
  expiresAt: string;
}

export default function TeamInviteEmail({
  teamName,
  inviterName,
  inviteeName,
  role,
  message,
  acceptUrl,
  expiresAt,
}: TeamInviteEmailProps) {
  const roleDescriptions = {
    admin: 'Administrator - Full access to manage team settings and members',
    member: 'Member - Access to team resources and collaboration features',
    viewer: 'Viewer - Read-only access to team resources',
  };

  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <BaseEmailTemplate
      previewText={`${inviterName} invited you to join ${teamName} on NOFX`}
    >
      <Heading className="text-2xl font-bold text-gray-900 mb-6">
        You've been invited to a team!
      </Heading>

      <Text className="text-base text-gray-700 mb-4">
        Hi {inviteeName},
      </Text>

      <Text className="text-base text-gray-700 mb-4">
        <strong>{inviterName}</strong> has invited you to join <strong>{teamName}</strong> on NOFX Control Plane.
      </Text>

      {message && (
        <Section className="bg-gray-50 rounded-lg p-4 mb-6">
          <Text className="text-sm text-gray-600 mb-2">
            Message from {inviterName}:
          </Text>
          <Text className="text-base text-gray-700 italic">
            "{message}"
          </Text>
        </Section>
      )}

      <Section className="bg-blue-50 rounded-lg p-4 mb-6">
        <Text className="text-sm text-gray-600 mb-2">
          Your role will be:
        </Text>
        <Text className="text-base text-gray-700 font-semibold mb-1">
          {role.charAt(0).toUpperCase() + role.slice(1)}
        </Text>
        <Text className="text-sm text-gray-600">
          {roleDescriptions[role]}
        </Text>
      </Section>

      <Section className="text-center mb-6">
        <Button
          className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold no-underline"
          href={acceptUrl}
        >
          Accept Invitation
        </Button>
      </Section>

      <Text className="text-sm text-gray-500 mb-4">
        This invitation will expire on {expiryDate}.
      </Text>

      <Section className="border-t border-gray-200 pt-4">
        <Heading className="text-lg font-semibold text-gray-900 mb-3">
          What is NOFX Control Plane?
        </Heading>

        <Text className="text-base text-gray-700 mb-2">
          NOFX is a powerful workflow orchestration platform that helps teams:
        </Text>

        <ul className="text-base text-gray-700 mb-4 pl-5">
          <li>• Build and deploy serverless workflows</li>
          <li>• Manage API integrations and automation</li>
          <li>• Monitor and optimize performance</li>
          <li>• Collaborate on complex projects</li>
        </ul>

        <Text className="text-base text-gray-700">
          By joining {teamName}, you'll be able to collaborate on workflows,
          share resources, and work together more effectively.
        </Text>
      </Section>

      <Section className="border-t border-gray-200 pt-4 mt-6">
        <Text className="text-sm text-gray-500">
          If you didn't expect this invitation or don't want to join this team,
          you can safely ignore this email. The invitation will expire automatically.
        </Text>
      </Section>

      <Section className="text-center mt-6">
        <Text className="text-sm text-gray-500">
          Having trouble with the button?{' '}
          <Link
            href={acceptUrl}
            className="text-blue-600 underline"
          >
            Click here to accept
          </Link>
        </Text>
      </Section>
    </BaseEmailTemplate>
  );
}
