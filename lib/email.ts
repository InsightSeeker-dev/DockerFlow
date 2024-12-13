import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
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
