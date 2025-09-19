import Util from "@/utils/util.js";
import Const from "@/constants/const.js";
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
 * GET送信の結果
 * @param {string} uri リクエストURL
 * @param {Array} reqestData 送信するリクエストボディのデータ
 * @returns fetch結果
 */
const getRequest = (uri) => {
  // HttpMeshodに Getを設定する
  const method = METHOD.GET;
  // リクエストデータ作成
  const requestDatas = createRequestData(uri, null, null, method);
  // fetch返却
  return fetcher(requestDatas);
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
 * DELETE送信の結果
 * @param {string} uri リクエストURL
 * @param {Array} reqestData 送信するリクエストボディのデータ
 * @returns fetch結果
 */
const deleteRequest = (uri) => {
  // HttpMeshodに Getを設定する
  const method = METHOD.DELETE;
  // リクエストデータ作成
  const requestDatas = createRequestData(uri, null, null, method);
  // fetch返却
  return fetcher(requestDatas);
};

/**
 * fetch送信する
 * @param {Object} requestDatas リクエスト送信の設定情報
 * @returns fetch結果
 */
const fetcher = async (requestDatas) => {
  const response = await fetch(requestDatas.requestUrl, requestDatas.options);
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
    options = { method, headers, body };
  } else {
    options = { method, headers };
  }
  //   if (uri.substr(0, 1) === "/") {
  //     uri = uri.substr(1);
  //   }
  //   const customuri = API_PREFIX + uri;
  const customuri = Const.API_PREFIX_PATH.LOCAL_HOST + uri;
  return {
    requestUrl: customuri,
    options,
  };
};
export default {
  getRequest,
  postRequest,
  deleteRequest
};
