"""SMS sending (MSG91 OTP API).

Settings (environment):
  MSG91_AUTH_KEY     your MSG91 auth key
  MSG91_TEMPLATE_ID  DLT-approved OTP template id; the template text must contain the variable ##OTP##
  ALLOW_DEV_OTP      "true" = when MSG91 is not configured, only write the OTP to the server log
                     (for local testing; never use in production)
"""
import os
import logging
import requests

logger = logging.getLogger(__name__)

MSG91_OTP_URL = 'https://control.msg91.com/api/v5/otp'


class SmsError(Exception):
    pass


def configured():
    return bool(os.environ.get('MSG91_AUTH_KEY') and os.environ.get('MSG91_TEMPLATE_ID'))


def dev_mode():
    return os.environ.get('ALLOW_DEV_OTP', '').strip().lower() in ('1', 'true', 'yes')


def send_otp(mobile10, otp, expiry_minutes=10):
    """Send `otp` to a 10-digit Indian mobile number. Raises SmsError on failure."""
    if not configured():
        if dev_mode():
            logger.warning("DEV OTP for %s is %s (SMS not sent: MSG91 is not configured)", mobile10, otp)
            return
        raise SmsError('SMS service is not configured.')

    try:
        resp = requests.post(
            MSG91_OTP_URL,
            params={
                'template_id': os.environ['MSG91_TEMPLATE_ID'],
                'mobile': '91' + mobile10,
                'authkey': os.environ['MSG91_AUTH_KEY'],
                'otp': otp,
                'otp_expiry': expiry_minutes,
            },
            json={},
            timeout=15,
        )
        data = resp.json() if resp.content else {}
    except Exception as e:
        raise SmsError(f'Could not reach the SMS provider: {e}')

    if resp.status_code != 200 or data.get('type') != 'success':
        raise SmsError(f'SMS provider rejected the request: {data or resp.text[:200]}')
