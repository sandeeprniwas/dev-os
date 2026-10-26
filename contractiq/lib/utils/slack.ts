import { logger } from './logger'

/** Posts a plain-text alert to a Slack incoming webhook. Logs instead when no webhook is configured. */
export async function postSlack(webhookUrl: string | undefined, text: string): Promise<boolean> {
  if (!webhookUrl) {
    logger.warn('slack_alert_skipped', { reason: 'SLACK_ALERT_WEBHOOK_URL not configured', text })
    return false
  }
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!response.ok) logger.warn('slack_alert_failed', { status: response.status })
    return response.ok
  } catch (error) {
    logger.warn('slack_alert_failed', { error })
    return false
  }
}
