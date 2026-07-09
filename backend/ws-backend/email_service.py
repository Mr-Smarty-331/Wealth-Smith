import os
import random
import logging
from datetime import datetime, timedelta

logger = logging.getLogger("ws-backend")

def generate_otp() -> str:
    """Generate a 6-digit OTP."""
    return f"{random.randint(100000, 999999)}"

async def send_otp_email(recipient_email: str, otp_code: str) -> bool:
    """Send verification OTP. Fallback to console in dev."""
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT", "587")
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    sender_email = os.getenv("SENDER_EMAIL", "noreply@wealthsmith.ai")

    if smtp_server and smtp_user and smtp_password:
        try:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"{otp_code} is your Wealth Smith Verification Code"
            msg["From"] = sender_email
            msg["To"] = recipient_email

            text_content = f"Welcome to Wealth Smith!\n\nYour 6-digit email verification code is: {otp_code}\nThis code will expire in 10 minutes."
            html_content = f"""
            <html>
              <body style="font-family: Arial, sans-serif; background-color: #0d0f12; color: #ffffff; padding: 30px;">
                <div style="max-width: 500px; margin: 0 auto; background-color: #161920; border-radius: 20px; padding: 30px; border: 1px solid #262a34; text-align: center;">
                  <h2 style="color: #c4ff00; margin-bottom: 10px;">Wealth Smith AI</h2>
                  <p style="color: #9ca3af; font-size: 0.95rem;">Verify your email address to activate your trading account.</p>
                  <div style="background-color: #1e222d; padding: 20px; border-radius: 16px; margin: 25px 0; border: 1px solid #c4ff00;">
                    <span style="font-size: 2.2rem; font-weight: bold; letter-spacing: 6px; color: #c4ff00;">{otp_code}</span>
                  </div>
                  <p style="font-size: 0.8rem; color: #9ca3af;">This code is valid for 10 minutes. Do not share it with anyone.</p>
                </div>
              </body>
            </html>
            """
            msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(smtp_server, int(smtp_port)) as server:
                server.starttls()
                server.login(smtp_user, smtp_password)
                server.sendmail(sender_email, recipient_email, msg.as_string())
            
            logger.info(f"Successfully sent OTP email to {recipient_email} via SMTP/AWS SES.")
            return True
        except Exception as e:
            logger.error(f"Failed to send email via SMTP/AWS SES: {e}")

    # Local fallback
    logger.info(f"\n==================================================")
    logger.info(f"📧 EMAIL OTP DISPATCH (LOCAL DEV FALLBACK)")
    logger.info(f"Recipient: {recipient_email}")
    logger.info(f"Verification Code: {otp_code}")
    logger.info(f"==================================================\n")
    return True
