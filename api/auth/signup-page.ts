/**
 * Signup Page - Vercel API Route
 * Simple HTML signup form for production
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    // Serve the signup page
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NOFX Control Plane - Sign Up</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .container {
      background: white;
      padding: 2rem;
      border-radius: 10px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      width: 100%;
      max-width: 400px;
    }
    h1 {
      color: #333;
      margin-bottom: 0.5rem;
      font-size: 1.8rem;
    }
    .subtitle {
      color: #666;
      margin-bottom: 2rem;
      font-size: 0.95rem;
    }
    .form-group {
      margin-bottom: 1.5rem;
    }
    label {
      display: block;
      margin-bottom: 0.5rem;
      color: #555;
      font-weight: 500;
    }
    input {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid #e0e0e0;
      border-radius: 5px;
      font-size: 1rem;
      transition: border-color 0.3s;
    }
    input:focus {
      outline: none;
      border-color: #667eea;
    }
    button {
      width: 100%;
      padding: 0.75rem;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 5px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.3s;
    }
    button:hover {
      background: #5a67d8;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .error {
      background: #fee;
      color: #c33;
      padding: 0.75rem;
      border-radius: 5px;
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }
    .success {
      background: #efe;
      color: #3c3;
      padding: 0.75rem;
      border-radius: 5px;
      margin-bottom: 1rem;
      font-size: 0.9rem;
    }
    .links {
      margin-top: 1.5rem;
      text-align: center;
      font-size: 0.9rem;
    }
    .links a {
      color: #667eea;
      text-decoration: none;
    }
    .links a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Create Account</h1>
    <p class="subtitle">Join NOFX Control Plane</p>

    <div id="message"></div>

    <form id="signupForm">
      <div class="form-group">
        <label for="fullName">Full Name</label>
        <input
          type="text"
          id="fullName"
          name="fullName"
          placeholder="John Doe"
          autocomplete="name"
        />
      </div>

      <div class="form-group">
        <label for="email">Email (required)</label>
        <input
          type="email"
          id="email"
          name="email"
          required
          placeholder="you@example.com"
          autocomplete="email"
        />
      </div>

      <div class="form-group">
        <label for="password">Password (required)</label>
        <input
          type="password"
          id="password"
          name="password"
          required
          placeholder="At least 8 characters"
          autocomplete="new-password"
          minlength="8"
        />
      </div>

      <div class="form-group">
        <label for="companyName">Company (optional)</label>
        <input
          type="text"
          id="companyName"
          name="companyName"
          placeholder="Acme Inc."
          autocomplete="organization"
        />
      </div>

      <button type="submit" id="submitBtn">Create Account</button>
    </form>

    <div class="links">
      Already have an account?
      <a href="/api/login">Sign In</a>
    </div>
  </div>

  <script>
    const form = document.getElementById('signupForm');
    const messageDiv = document.getElementById('message');
    const submitBtn = document.getElementById('submitBtn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating account...';
      messageDiv.innerHTML = '';

      const fullName = document.getElementById('fullName').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const companyName = document.getElementById('companyName').value;

      try {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
            fullName: fullName || undefined,
            companyName: companyName || undefined
          }),
          credentials: 'include'
        });

        const data = await response.json();

        if (response.ok && data.success) {
          messageDiv.innerHTML = '<div class="success">Account created successfully! Redirecting to login...</div>';

          // If we got a session, store it and redirect to app
          if (data.session?.accessToken) {
            localStorage.setItem('sb-access-token', data.session.accessToken);
            setTimeout(() => {
              window.location.href = '/ui/app/#/runs';
            }, 1500);
          } else {
            // Otherwise redirect to login
            setTimeout(() => {
              window.location.href = '/api/login';
            }, 1500);
          }
        } else {
          messageDiv.innerHTML = '<div class="error">' + (data.error || 'Signup failed') + '</div>';
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Account';
        }
      } catch (error) {
        messageDiv.innerHTML = '<div class="error">Network error. Please try again.</div>';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
      }
    });
  </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}