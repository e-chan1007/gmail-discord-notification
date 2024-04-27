export const fetchJSON = (
  url: string,
  options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {},
  fetch = UrlFetchApp.fetch
) => {
  const response = fetch(url, options);
  let result = null;
  try {
    result = JSON.parse(response.getContentText());
  } catch (ignored) {
    result = response.getContentText();
  }
  return result;
};
