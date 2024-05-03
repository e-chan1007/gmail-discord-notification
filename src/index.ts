import { fetchJSON } from "./util.js";

declare global {
  var checkMail: (labelMap: LabelMap, properties: GoogleAppsScript.Properties.Properties) => void;
}

const lastCheckedKey = "GmailDiscordNotification_lastChecked";

interface LabelRule {
  webhookURL: string;
  ignore?: boolean;
  discordOptions?: object;
  discordEmbedOptions?: object;
}

interface LabelMap {
  default: LabelRule;
  [key: string]: Partial<LabelRule>;
}

const myMailAddress = Session.getActiveUser().getEmail();

global.checkMail = (labelMap: LabelMap, properties: GoogleAppsScript.Properties.Properties) => {
  const lastChecked = parseInt(
    properties.getProperty(lastCheckedKey) || "0"
  );

  const threads = GmailApp.search(`in:inbox after:${lastChecked}`);

  if (threads && threads.length > 0) {
    const threadData = threads.map((thread) => {
      const message = thread.getMessages().at(-1)!;
      return {
        id: message.getId(),
        labels: thread.getLabels(),
        date: message.getDate(),
        from: message.getFrom(),
        to: message.getTo(),
        subject: message.getSubject(),
        body: message.getPlainBody()
      };
    });

    threadData.sort((a, b) => a.date.getTime() - b.date.getTime());

    const rateLimitPerMinute = 50;
    const shouldSleep = threadData.length > rateLimitPerMinute;

    for(const data of threadData) {
      const labelRule = Object.entries(labelMap).find(([key]) =>
        data.labels.some((label) => label.getName() === key)
      )?.[1] || labelMap.default;
      if(labelRule.ignore) return;
      const webhookURL = labelRule.webhookURL || labelMap.default.webhookURL;
      let title = data.subject || "(件名なし)";
      if (title.length > 0xFF - 3) {
        title = title.slice(0, 0xFF - 3) + "...";
      }
      let body = data.body;
      if (body.length > 0xFFF - 3) {
        body = body.slice(0, 0xFFF - 3) + "...";
      }
      const result = fetchJSON(webhookURL, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          embeds: [
            {
              type: "rich",
              title,
              url: `https://mail.google.com/mail/u/${myMailAddress}/#inbox/${data.id}`,
              description: body,
              timestamp: data.date.toISOString(),
              author: { name: data.from },
              ...(labelRule.discordEmbedOptions || labelMap.default.discordEmbedOptions),
            },
          ],
          ...(labelRule.discordOptions || labelMap.default.discordOptions),
        }),
      });
      if(shouldSleep) Utilities.sleep(60e3 / rateLimitPerMinute);
      else Utilities.sleep(0.5e3);
    }
  }

  properties.setProperty(
    lastCheckedKey,
    (new Date().getTime() / 1000).toFixed(0)
  );
};
