import { NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email';
import nodemailer from 'nodemailer';

export async function GET(request: Request) {
  try {
    console.log('Testing SMTP configuration...');

    // Afficher la configuration SMTP (sans le mot de passe)
    console.log('SMTP Config:', {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      from: process.env.SMTP_FROM,
    });

    // Créer un transporteur de test
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3',
      },
      debug: true,
    });

    // Vérifier la configuration
    console.log('Verifying SMTP connection...');
    await transporter.verify();
    console.log('SMTP connection verified successfully');

    // Envoyer un email de test
    console.log('Sending test email...');
    const info = await sendEmail({
      to: process.env.SMTP_USER!, // Envoyer à l'adresse configurée
      subject: 'DockerFlow SMTP Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">SMTP Test Successful!</h1>
          <p>This email confirms that your SMTP configuration is working correctly.</p>
          <p>Configuration details:</p>
          <ul>
            <li>Host: ${process.env.SMTP_HOST}</li>
            <li>Port: ${process.env.SMTP_PORT}</li>
            <li>Secure: ${process.env.SMTP_SECURE}</li>
            <li>From: ${process.env.SMTP_FROM}</li>
          </ul>
          <p>Time sent: ${new Date().toISOString()}</p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: 'SMTP test completed successfully',
      details: {
        messageId: info.messageId,
        response: info.response,
        previewUrl: nodemailer.getTestMessageUrl(info),
      },
    });
  } catch (error: any) {
    console.error('SMTP test failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      details: {
        name: error.name,
        code: error.code,
        command: error.command,
        response: error.response,
      },
    }, { status: 500 });
  }
}
