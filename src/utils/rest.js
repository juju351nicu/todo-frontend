import Util from "./util.js";
/**
 * Methodの定数
 */
const METHOD = {
  GET: "Get",
  POST: "Post",
  PUT: "Put",
  DELETE: "Delete",
};

/**
 * デフォルトのリクエストヘッダ情報
 */
const defaultHeader = {
  Accept: "application/json",
  ContentType: "application/json",
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
 * MultiPart送信の結果
 * @param {string} uri リクエストURL
 * @param {Array} reqestData 送信するリクエストボディのデータ
 * @returns fetch結果
 */
const multipartRequest = (uri, params) => {
  //HTTPMethodにPOSTを設定する
  const method = METHOD.POST;
  // リクエストデータ作成
  const requestDatas = createRequestData(uri, null, null, method);
  // パラメータ置換
  const formData = new FormData();
  if (Array.isArray(params)) {
    params.forEach((param) => {
      if (param.key !== undefined && param.value !== undefined) {
        formData.append(param.key, param.value);
      }
    });
  }
  requestDatas.options.headers.delete("Accept");
  requestDatas.options.headers.delete("Content-Type");
  requestDatas.options.body = formData;
  return fetcher(requestDatas);
};

/**
 *
 * @param {*} requestDatas
 * @returns
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
    });
  }
  // optionsで HTTPMethodやHeadersを設定する
  const options = { method, headers };
  // HTTPメソッドがPOST・PUTの場合のみリクエストボディを追加する
  if (method === METHOD.POST || method === METHOD.PUT) {
    // options.body = JSON.stringify(reqData);
    options.body = reqData;
  }
  //   if (uri.substr(0, 1) === "/") {
  //     uri = uri.substr(1);
  //   }
  //   const customuri = API_PREFIX + uri;
  const customuri = uri;
  return {
    requestUrl: customuri,
    options,
  };
};
export default {
  postRequest,
  multipartRequest,
};
