/**
 * 値があるかどうか判定する。
 * リストの場合は空かどうかを判定する。
 * @param {string} target 値
 * @returns 判定結果
 */
const isEmpty = (target) => {
  return (
    target === null ||
    target === undefined ||
    ((typeof target === "string" || target instanceof Array) &&
      target.length <= 0)
  );
};
/**
 * ブラウザがHTML5ローカルストレージをサポートしているかどうかを判断する
 */
const isLocalStorage = () => {
  try {
    if ("localStorage" in window && window["localStorage"] !== null) {
      console.log("localStorage は使用可能です。");
    }
  } catch (error) {
    console.log("error" + error);
  }
};
/**
 * ローカルストレージから値を取得する
 * @param {string} key キー
 * @returns 取得結果
 */
const getLocalStorage = (key) => {
  return localStorage.getItem(key);
};

/**
 * ローカルストレージに値を設定する
 * @param {string} key キー
 * @param {string} value 値
 */
const setLocalStorage = (key, value) => {
  localStorage.setItem(key, value);
};
/**
 * ローカルストレージの値を削除する
 */
const removeLocalStorage = () => {
  localStorage.removeItem("saveFolder");
};
/**
 * 指定したkeyに該当するcookieの値を取得する
 * @param {string} key 指定したkey
 * @returns cookieの値
 */
const getCookieValue = (key) => {
  const cookies = document.cookie.split(";");
  const foundCookie = cookies.find(
    (cookie) => cookie.split("=")[0].trim() === key.trim()
  );
  if (foundCookie) {
    const cookieValue = decodeURIComponent(foundCookie.split("=")[1]);
    return cookieValue;
  }
  return "";
};
/**
 * 何のブラウザかをチェックする
 */
const checkBrowser = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  if (userAgent.indexOf("msie") != -1 || userAgent.indexOf("trident") != -1) {
    console.log("Internet Explorerをお使いですね");
  } else if (userAgent.indexOf("edge") != -1) {
    console.log("Edgeをお使いですね");
  } else if (userAgent.indexOf("chrome") != -1) {
    console.log("Google Chromeをお使いですね");
  } else if (userAgent.indexOf("safari") != -1) {
    console.log("Safariをお使いですね");
  } else if (userAgent.indexOf("firefox") != -1) {
    console.log("FireFoxをお使いですね");
  } else if (userAgent.indexOf("opera") != -1) {
    console.log("Operaをお使いですね");
  } else {
    console.log("そんなブラウザは知らん");
  }
};
/**
 * 値が正規表現とマッチしているかどうかをチェックする
 * 現状「整数」かどうかと値が「整数 - 整数」かどうかをチェックする
 * @param {string} target チェックする値
 * @param {string} pattern 正規表現と照合する文字列
 * @returns 判定結果
 */
const checkByRegEx = (target, pattern) => {
  if (target == "") {
    return true;
  }
  const regex = pattern;
  if (regex.test(target)) {
    return true;
  }
  return false;
};
/**
 * 文字列の中にあるスペースを削除して返却する
 * @param {string} target 文字列
 * @returns 変換した文字列
 */
const trimSpace = (target) => {
  return target.replace(/\s*/g, "");
};
/**
 * 全角英数字を半角に変換
 * @param {string} target 文字列
 * @returns 変換した文字列
 */
const toHalfWidth = (target) => {
  target = target.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => {
    return String.fromCharCode(s.charCodeAt(0) - 0xfee0);
  });
  return target;
};
/**
 * 引数に指定した複数の値の中から最大の値を 1 つ戻り値として返します。
 * @param {number} a 数値a
 * @param {number} b 数値b
 * @returns 最大の値
 */
const aryMax = (a, b) => {
  return Math.max(a, b);
};
/**
 * 引数に指定した複数の値の中から最小の値を 1 つ戻り値として返します。
 * @param {number} a 数値a
 * @param {number} b 数値b
 * @returns 最小の値
 */
const aryMin = (a, b) => {
  return Math.min(a, b);
};
/**
 * ページ番号が数値かどうかチェックする
 * @param {string} pageText 差し替えページ番号
 * @returns 判定結果
 */
const checkNumericPage = (pageText) => {
  //整数でない場合、チェックを外す。
  if (isEmpty(pageText)) {
    return false;
  }
  //テキストボックスの文字列が空の場合、チェックを外す。ページ番号の不正。
  if (!Number.isInteger(parseInt(pageText))) {
    return false;
  }
  return true;
};
/**
 * 配列の重複を無くす。
 * @param {Array} array 配列
 * @returns 重複を無くしたプリミティブ型の配列
 */
const uniqArrayBySet = (array) => {
  return Array.from(new Set(array));
};
/**
 * 改行、水平タブを削除する。
 * @param {string} target 文字列
 * @returns 改行等を削除した文字列
 */
const replaceBlank = (target) => {
  let dest = null;
  if (!isEmpty(target)) {
    dest = target.replace(/\\s*|\t|\r|\n/, "");
  }
  return dest;
};
/**
 * 文字列から、スペース、改行等を削除しリスト型にして返却する。
 * @param {string} target 文字列
 * @param {string} delimiter 区切り文字
 * @returns 文字列リスト
 */
const getStrPageList = (target, delimiter) => {
  let strPageList = [];
  if (!isEmpty(target)) {
    strPageList = replaceBlank(target).toLowerCase().split(delimiter);
    return strPageList;
  }
  return strPageList;
};
/**
 * 受け取った文字列リストを数値リストにする
 * @param {Array} strList 文字列リスト
 * @returns
 */
const getNumberList = (strList) => {
  return strList.map((str) => Number(str));
};
export default {
  isEmpty,
  isLocalStorage,
  getLocalStorage,
  setLocalStorage,
  removeLocalStorage,
  getCookieValue,
  checkBrowser,
  checkByRegEx,
  trimSpace,
  toHalfWidth,
  aryMax,
  aryMin,
  checkNumericPage,
  getStrPageList,
  uniqArrayBySet,
  replaceBlank,
  getNumberList,
};
