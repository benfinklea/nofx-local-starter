import { sendTeamDeletionWarningEmail } from '../../src/services/email/teamEmails';
import { createServiceClient } from '../../src/auth/supabase';
import { sendEmail } from '../../src/lib/email/resend-client';

jest.mock('../../src/auth/supabase', () => ({
  createServiceClient: jest.fn(),
}));

jest.mock('../../src/lib/email/resend-client', () => ({
  sendEmail: jest.fn(),
  isValidEmail: jest.fn().mockReturnValue(true),
}));

describe('team email helpers', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('sends deletion warning when admin user is returned as array', async () => {
    const single = jest.fn().mockResolvedValue({
      data: {
        name: 'Space Team',
        members: [
          {
            role: 'admin',
            user: [
              {
                email: 'admin@example.com',
                full_name: 'Ada Admin',
              },
            ],
          },
        ],
      },
      error: null,
    });

    const eq = jest.fn().mockReturnValue({ single });
    const select = jest.fn().mockReturnValue({ eq });
    const from = jest.fn().mockReturnValue({ select });

    (createServiceClient as jest.Mock).mockReturnValue({ from });
    (sendEmail as jest.Mock).mockResolvedValue({ success: true, id: 'email-123' });

    const result = await sendTeamDeletionWarningEmail('team-123', 3);

    expect(result).toBe(true);
    expect(from).toHaveBeenCalledWith('teams');
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'admin@example.com' })
    );
  });
});
