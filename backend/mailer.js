import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .env is loaded from backend directory
dotenv.config({ path: path.join(__dirname, '.env') });

let cachedEtherealTransporter = null;

/**
 * Resolves or creates an active email transporter.
 * Prioritizes:
 * 1. Custom SMTP credentials from .env
 * 2. Gmail App Password from .env
 * 3. Ethereal Email (live zero-config test dispatch with real preview)
 */
async function getTransporter() {
  // Always refresh .env in case user updated credentials
  dotenv.config({ path: path.join(__dirname, '.env') });

  // 1. Custom SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return {
      transporter: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      }),
      isReal: true,
      provider: 'custom_smtp',
    };
  }

  // 2. Gmail Service
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASS) {
    const cleanAppPass = process.env.GMAIL_APP_PASS.replace(/\s+/g, '');
    return {
      transporter: nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER.trim(),
          pass: cleanAppPass,
        },
      }),
      isReal: true,
      provider: 'gmail',
    };
  }

  // 3. Fallback: Ethereal Email (Live network dispatch with web preview)
  if (!cachedEtherealTransporter) {
    const testAccount = await nodemailer.createTestAccount();
    cachedEtherealTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  return {
    transporter: cachedEtherealTransporter,
    isReal: false,
    provider: 'ethereal',
  };
}

/**
 * Dispatches a verification email with HTML styling and high deliverability.
 */
export async function sendEmailOTP(toEmail, code, purpose = 'register') {
  try {
    const { transporter, isReal, provider } = await getTransporter();

    const isReset = purpose === 'reset';
    const subject = isReset
      ? '🔐 FoundersGate Password Reset Code'
      : '🚀 FoundersGate Verification Code';

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; background: #e0e5ec; border-radius: 20px; box-shadow: 8px 8px 16px #b8b9be, -8px -8px 16px #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #2d3748; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">FoundersGate</h1>
          <p style="color: #718096; font-size: 13px; margin: 4px 0 0;">${isReset ? 'Account Password Recovery' : 'Account Identity Verification'}</p>
        </div>
        
        <div style="background: #e0e5ec; border-radius: 16px; padding: 24px; box-shadow: inset 4px 4px 8px #b8b9be, inset -4px -4px 8px #ffffff; text-align: center; margin-bottom: 24px;">
          <p style="color: #4a5568; font-size: 14px; margin: 0 0 10px; font-weight: 500;">
            ${isReset ? 'Your password reset code is:' : 'Your 6-digit verification code is:'}
          </p>
          <div style="font-size: 38px; font-weight: 900; letter-spacing: 10px; color: #4f46e5; font-family: monospace; padding: 12px 0;">
            ${code}
          </div>
          <p style="color: #a0aec0; font-size: 12px; margin: 8px 0 0;">Valid strictly for 10 minutes. Maximum 3 attempts.</p>
        </div>
        
        <p style="color: #718096; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
          If you did not request this verification code, please ignore this email. Never disclose this code to anyone.
        </p>
      </div>
    `;

    const fromAddress = provider === 'gmail' && process.env.GMAIL_USER
      ? `"FoundersGate Security" <${process.env.GMAIL_USER.trim()}>`
      : (process.env.EMAIL_FROM || '"FoundersGate Security" <no-reply@foundersgate.com>');

    const info = await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject,
      text: `Your FoundersGate verification code is: ${code}. Valid for 10 minutes. (Max 3 attempts).`,
      html: htmlContent,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info) || null;

    console.log(`\n======================================================`);
    console.log(`[DISPATCH SUCCESS] Provider: ${provider.toUpperCase()}`);
    console.log(`Recipient: ${toEmail}`);
    console.log(`Message ID: ${info.messageId}`);
    if (previewUrl) {
      console.log(`Live Preview URL: ${previewUrl}`);
    }
    console.log(`======================================================\n`);

    return {
      success: true,
      provider,
      isReal,
      messageId: info.messageId,
      previewUrl,
    };
  } catch (error) {
    console.warn('[DISPATCH NOTICE] Fallback to Ethereal live preview:', error.message);
    try {
      if (!cachedEtherealTransporter) {
        const testAccount = await nodemailer.createTestAccount();
        cachedEtherealTransporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      }

      const fallbackInfo = await cachedEtherealTransporter.sendMail({
        from: '"FoundersGate Security" <no-reply@foundersgate.com>',
        to: toEmail,
        subject: purpose === 'reset' ? '🔐 FoundersGate Password Reset Code' : '🚀 FoundersGate Verification Code',
        text: `Your FoundersGate verification code is: ${code}. Valid for 10 minutes. (Max 3 attempts).`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #e0e5ec; border-radius: 16px;">
            <h2 style="color: #2d3748; text-align: center; margin: 0 0 16px;">FoundersGate</h2>
            <div style="background: #e0e5ec; border-radius: 12px; padding: 20px; text-align: center; box-shadow: inset 4px 4px 8px #b8b9be, inset -4px -4px 8px #ffffff;">
              <p style="color: #4a5568; margin: 0 0 10px; font-size: 14px;">Your 6-digit verification code is:</p>
              <div style="font-size: 36px; font-weight: 800; color: #4f46e5; letter-spacing: 8px; font-family: monospace;">${code}</div>
              <p style="color: #a0aec0; font-size: 12px; margin: 8px 0 0;">Valid for 10 minutes. Max 3 attempts.</p>
            </div>
          </div>
        `,
      });

      const fallbackPreviewUrl = nodemailer.getTestMessageUrl(fallbackInfo) || null;
      console.log(`[ETHEREAL PREVIEW URL] ${fallbackPreviewUrl}`);

      return {
        success: true,
        provider: 'ethereal',
        isReal: false,
        messageId: fallbackInfo.messageId,
        previewUrl: fallbackPreviewUrl,
      };
    } catch (fallbackError) {
      console.error('[FALLBACK ERROR]', fallbackError);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

/**
 * Dispatches an SMS verification code via Twilio if configured,
 * or gracefully notifies the user and sends code to email.
 */
export async function sendSmsOTP(countryCode, phoneNumber, code, purpose = 'register', linkedEmail = null) {
  const cleanDigits = phoneNumber.replace(/\D/g, '');
  const dialCode = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
  const fullPhone = `${dialCode}${cleanDigits}`;

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (sid && token && from) {
    try {
      const params = new URLSearchParams({
        To: fullPhone,
        From: from,
        Body: `[FoundersGate] Your verification code is ${code}. Valid for 10 minutes. Do not share.`,
      });

      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json();
      if (data.sid) {
        console.log(`[TWILIO SMS SENT] To: ${fullPhone} | SID: ${data.sid}`);
        return { success: true, provider: 'twilio', sid: data.sid };
      } else {
        console.error('[TWILIO ERROR]', data);
      }
    } catch (err) {
      console.error('[TWILIO EXCEPTION]', err);
    }
  }

  // If Twilio is not configured, also dispatch email if linked email is available
  let emailFallback = null;
  if (linkedEmail) {
    emailFallback = await sendEmailOTP(linkedEmail, code, purpose);
  }

  return {
    success: true,
    provider: sid ? 'twilio_failed_fallback' : 'no_twilio_configured',
    notice: sid ? null : 'Twilio SMS credentials not configured in backend/.env',
    previewUrl: emailFallback ? emailFallback.previewUrl : null,
    emailFallbackDispatched: !!emailFallback,
  };
}

