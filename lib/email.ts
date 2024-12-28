import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

interface VerificationEmailParams {
  email: string;
  token: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  console.log('Starting email configuration with:', {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      // Ne pas logger le mot de passe pour des raisons de sécurité
    }
  });

  // Créer le transporteur avec des options plus détaillées
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false, // Accepter les certificats auto-signés
      ciphers: 'SSLv3',
    },
    debug: true, // Activer le débogage
  });

  try {
    // Vérifier la configuration SMTP
    console.log('Verifying SMTP configuration...');
    await transporter.verify();
    console.log('SMTP configuration verified successfully');

    // Envoyer l'email
    console.log('Attempting to send email to:', to);
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"DockerFlow" <noreply@dockerflow.com>',
      to,
      subject,
      html,
    });

    console.log('Email sent successfully:', {
      messageId: info.messageId,
      response: info.response,
    });

    return info;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  secure: process.env.SMTP_SECURE === 'true',
});

export async function sendVerificationEmail(email: string, token: string) {
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/verify-email?token=${token}`;

  const mailOptions = {
    from: process.env.SMTP_FROM,
    to: email,
    subject: 'Vérifiez votre adresse email',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Vérification de votre adresse email</h2>
        <p>Merci de vous être inscrit ! Pour activer votre compte, veuillez cliquer sur le lien ci-dessous :</p>
        <p>
          <a href="${verificationUrl}" style="background-color: #0070f3; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Vérifier mon email
          </a>
        </p>
        <p>Ce lien expirera dans 24 heures.</p>
        <p>Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
}
