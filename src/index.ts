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

    threadData.forEach((data) => {
      const labelRule = Object.entries(labelMap).find(([key]) =>
        data.labels.some((label) => label.getName() === key)
      )?.[1] || labelMap.default;
      if(labelRule.ignore) return;
      const webhookURL = labelRule.webhookURL || labelMap.default.webhookURL;
      const result = fetchJSON(webhookURL, {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify({
          embeds: [
            {
              type: "rich",
              title: `${data.subject}`,
              url: `https://mail.google.com/mail/u/${myMailAddress}/#inbox/${data.id}`,
              description: data.body,
              timestamp: data.date.toISOString(),
              author: { name: data.from },
              ...(labelRule.discordEmbedOptions || labelMap.default.discordEmbedOptions),
            },
          ],
          ...(labelRule.discordOptions || labelMap.default.discordOptions),
        }),
      });
      console.log(result);
    });
  }

  properties.setProperty(
    lastCheckedKey,
    (new Date().getTime() / 1000).toFixed(0)
  );
};
