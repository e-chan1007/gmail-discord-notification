import { fetchJSON } from "./util.js";

declare global {
	var checkMail: (
		baseOptions: Option[],
		properties: GoogleAppsScript.Properties.Properties,
	) => void;
}

const lastCheckedKey = "GmailDiscordNotification_lastChecked";
const rateLimitPerMinute = 50;

interface NotifyOptions {
	webhookURL?: string;
	ignore?: boolean;
	discordOptions?: object;
	discordEmbedOptions?: object;
}

interface Option extends NotifyOptions {
	query?: string;
	default?: boolean;
}

interface ThreadData {
	id: string;
	labels: GoogleAppsScript.Gmail.GmailLabel[];
	date: Date;
	from: string;
	to: string;
	cc: string;
	subject: string;
	body: string;
	searchedBy: Option;
}

const myMailAddress = Session.getActiveUser().getEmail();

const mySendAsAddresses = (Gmail.Users?.Settings?.SendAs?.list("me").sendAs || []).map(sendAs => sendAs.sendAsEmail).filter((sendAs) : sendAs is string => !!sendAs);
mySendAsAddresses.push(myMailAddress);

const getLastReceivedMail = (messages: GoogleAppsScript.Gmail.GmailMessage[]) => {
  const lastReceivedMail = messages
    .filter((message) => !mySendAsAddresses.some((sendAs) => message.getFrom() === sendAs))
    .at(-1);
  return lastReceivedMail;
}

global.checkMail = (
	baseOptions: Option[],
	properties: GoogleAppsScript.Properties.Properties,
) => {
	const options = baseOptions.map((option) => ({ ...option }));
	const hasDefault = options.some((option) => option.default);
	if (!hasDefault) {
		if (options.length === 0) return;
		if (options.every((option) => option.ignore)) return;
		if (options.every((option) => !option.webhookURL)) return;
		const newDefaultOption = options.find(
			(option) => !option.query,
		) || options[0];
		if (!newDefaultOption) return;
		newDefaultOption.default = true;
	}
	const defaultOption = options.find((option) => option.default);
	if (!defaultOption) throw new Error("No default option is provided");
	options.splice(options.indexOf(defaultOption), 1);

	const lastChecked = Number.parseInt(
		properties.getProperty(lastCheckedKey) || `${new Date().getTime() / 1000}`,
	);
	const nextCheck = Math.floor(new Date().getTime() / 1000);
	const updateLastChecked = () =>
		properties.setProperty(
			lastCheckedKey,
			nextCheck.toFixed(0),
		);

  const inboxQuery = `in:inbox`;
  const dateRangeQuery = `after:${lastChecked} before:${nextCheck - 1}`;
	const allThreads = GmailApp.search(`${inboxQuery} ${dateRangeQuery}`);

	if (!allThreads || allThreads.length === 0) return updateLastChecked();

	const threadData: ThreadData[] = [];

	for (const option of options) {
		if (!option.query) continue;
    const hasInQuery = option.query.split(" ").some(v => v.startsWith("in:"));
		const threads =  hasInQuery ? GmailApp.search(
			`${dateRangeQuery} ${option.query}`,
		) : GmailApp.search(
      `${inboxQuery} ${dateRangeQuery} ${option.query}`,
    );
		if (!threads || threads.length === 0) continue;
		const appendThreadData = threads
			.map((thread) => {
				const message = getLastReceivedMail(thread.getMessages());
				if (!message) return null;
				return {
					id: message.getId(),
					labels: thread.getLabels(),
					date: message.getDate() as Date,
					from: message.getFrom(),
					to: message.getTo(),
					cc: message.getCc(),
					subject: message.getSubject(),
					body: message.getPlainBody(),
					searchedBy: option,
				};
			})
			.filter((data) => data !== null)
      .filter(data => threadData.every((d) => d.id !== data.id));
		threadData.push(...appendThreadData);
	}

	for (const thread of allThreads) {
		const message = getLastReceivedMail(thread.getMessages());
		if (!message || threadData.some((data) => data.id === message.getId()))
			continue;

		threadData.push({
			id: message.getId(),
			labels: thread.getLabels(),
			date: message.getDate() as Date,
			from: message.getFrom(),
			to: message.getTo(),
			cc: message.getCc(),
			subject: message.getSubject(),
			body: message.getPlainBody(),
			searchedBy: defaultOption,
		});
	}
	threadData.sort((a, b) => a.date.getTime() - b.date.getTime());

	const shouldSleep = threadData.length > rateLimitPerMinute;

	for (const data of threadData) {
		const option = data.searchedBy;
		if (option.ignore) continue;
		const webhookURL = option.webhookURL || defaultOption.webhookURL;
		if (!webhookURL) continue;
		let title = data.subject || "無題";
		if (title.length > 0xff - 3) {
			title = `${title.slice(0, 0xff - 3)}...`;
		}
		let body = `\`\`\`To: ${data.to}`;
		if (data.cc) body += `\nCc: ${data.cc}`;
		body += `\`\`\`\n${data.body}`;
		if (body.length > 0xfff - 3) {
			body = `${body.slice(0, 0xfff - 3)}...`;
		}
		fetchJSON(webhookURL, {
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
						...(option.discordEmbedOptions ||
							defaultOption.discordEmbedOptions),
					},
				],
				...(option.discordOptions || defaultOption.discordOptions),
			}),
		});
		if (shouldSleep) Utilities.sleep(60e3 / rateLimitPerMinute);
		else Utilities.sleep(0.5e3);
	}
	updateLastChecked();
};
