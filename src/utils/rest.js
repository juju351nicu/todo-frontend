import Util from "./util.js";
/**
 * Methodの定数
 */
const METHOD = {
  GET: "GET",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
};

/**
 * デフォルトのリクエストヘッダ情報
 */
const defaultHeader = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

/**
 * POST送信の結果
 * @param {string} uri リクエストURL
 * @param {Array} reqestData 送信するリクエストボディのデータ
 * @returns fetch結果
 */
const postRequest = (uri, reqestData) => {
  // HttpMeshodに Postを設定する
  const method = METHOD.POST;
  // リクエストデータ作成
  const requestDatas = createRequestData(uri, reqestData, null, method);
  // fetch返却
  return fetcher(requestDatas);
};

/**
 *
 * @param {*} requestDatas
 * @returns
 */
const fetcher = async (requestDatas) => {
  const response = await fetch(requestDatas.requestUrl, requestDatas.options);
  // const response = await fetch(requestDatas.requestUrl, {
  //   method: requestDatas.options.method,
  //   headers: requestDatas.options.headers,
  //   body: requestDatas.options.body,
  // });
  return response;
};
/**
 * リクエスト送信の設定情報を取得する
 *
 * @param {string} uri リクエストURL
 * @param {?} reqData 送信するリクエストボディのデータ
 * @param {Headers} customHeader カスタムヘッダー
 * @param {METHOD} method Methodの定数
 * @returns リクエスト送信の設定情報
 */
const createRequestData = (uri, reqData, customHeader, method) => {
  // リクエストヘッダ情報作成
  const headers = new Headers();
  // defaultHeader["ヘッダートークン"] = sessionStorage.getItem("トークンキー");
  if (!Util.isEmpty(customHeader)) {
    Object.keys(customHeader).forEach((key) => {
      headers.set(key, customHeader[key]);
    });
  } else {
    Object.keys(defaultHeader).forEach((key) => {
      headers.set(key, defaultHeader[key]);
      console.log(defaultHeader[key]);
    });
  }
  // optionsで HTTPMethodやHeadersを設定する
  let options = {};
  // HTTPメソッドがPOST・PUTの場合のみリクエストボディを追加する
  if (method === METHOD.POST || method === METHOD.PUT) {
    const body = JSON.stringify(reqData);
    options = { method, headers , body};
  } else {
    options = { method, headers };
  }
  //   if (uri.substr(0, 1) === "/") {
  //     uri = uri.substr(1);
  //   }
  //   const customuri = API_PREFIX + uri;
  const customuri = uri;
  // const response = await fetch(uri,{
  //   method: 'POST', // HTTPメソッドをPOSTに指定します [1, 5]
  //   headers: {
  //     'Content-Type': 'application/json' // 送信するデータの形式を指定します
  //     // 必要に応じて他のヘッダーも追加します
  //   },
  //   body: JSON.stringify(reqData) // 送信するデータをJSON形式に変換してbodyに設定します [2, 5]
  // });

  // return response;
  return {
    requestUrl: customuri,
    options,
  };
};
export default {
  postRequest,
};
