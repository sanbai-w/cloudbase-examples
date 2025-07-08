import {
  AbstractSDKRequest,
  IRequestOptions,
  IUploadRequestOptions,
  StorageInterface,
  WebSocketInterface,
  WebSocketContructor,
  SDKAdapterInterface,
  StorageType,
  formatUrl,
  IRequestMethod,
  IRequestConfig,
  IFetchOptions,
} from "@cloudbase/adapter-interface";
import { ReadableStream } from "web-streams-polyfill";
// eslint-disable-next-line
declare const uni;
// declare const App;
// declare const getApp;
// declare const Page;
/**
 * 判断是否为uniapp runtime
 */
function isMatch(): boolean {
  if (typeof uni === 'undefined' || typeof uni.getSystemInfoSync !== 'function') {
    return false;
  }
  // if (typeof Page === 'undefined') {
  //   return false;
  // }
  // if (!uni.getSystemInfoSync) {
  //   return false;
  // }
  if (!uni.getStorageSync) {
    return false;
  }
  if (!uni.setStorageSync) {
    return false;
  }
  if (!uni.connectSocket) {
    return false;
  }
  if (!uni.request) {
    return false;
  }

  try {
    // uni.getSystemInfoSync() 在所有 uni-app 平台都应返回一个包含平台信息的对象。
    // 检查其返回值及 `platform` 属性是确认环境真实性的关键。
    const info = uni.getSystemInfoSync();
    // 如果 info 是一个真值 (truthy) 且包含 platform 属性，则可以确信是 uni-app 环境。
    return !!(info && info.platform);
  } catch (e) {
    return false;
  }

  // return true;
}

function isPlugin(){
  // uniapp环境下，编译到小程序平台时，此逻辑依然可能适用
  // return typeof App === 'undefined' && typeof getApp === 'undefined';
  try {
    // uni.getAccountInfoSync() 在多端环境下可用
    const info = uni.getAccountInfoSync();
    // 插件环境下返回插件appid
    return !!(info && info.plugin);
  } catch (e) {
    // 如果获取账号信息失败，默认不是插件环境
    return false;
  }
}

const TASK_ABORT_ERROR_MSG = "Error when aborting requestTask";

export class UniRequest extends AbstractSDKRequest {
  // 默认不限超时
  private readonly _timeout: number;
  // 超时提示文案
  private readonly _timeoutMsg: string;
  // 超时受限请求类型，默认所有请求均受限
  private readonly _restrictedMethods: IRequestMethod[];
  constructor(config: IRequestConfig={}) {
    super();
    const { timeout, timeoutMsg, restrictedMethods } = config;
    this._timeout = timeout || 0;
    this._timeoutMsg = timeoutMsg || '请求超时';
    this._restrictedMethods = restrictedMethods || ['get', 'post', 'upload', 'download'];
  }
  // 适配器的 post 方法,测试成功
  post(options: IRequestOptions) {
    const self = this;
    return new Promise((resolve, reject) => {
      console.log('[Adapter.post] Entered Promise. Options:', options);
      const { url, data, headers } = options;

      const finalUrl = formatUrl("https:", url);

      const task = uni.request({
        url: finalUrl,
        data,
        timeout: self._timeout,
        method: "POST",
        header: headers,
        success(res) {
          // console.log('[Adapter.success] Raw response:', res);
          // resolve(res);
          // 根据 HTTP 状态码判断成功与否
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // 只要状态码是 2xx，就认为请求成功，并把收到的数据 resolve 出去
            resolve(res);
          } else {
            // 其他所有状态码都认为是失败，并 reject
            reject({
              statusCode: res.statusCode,
              errMsg: `Request failed with status code ${res.statusCode}`,
              data: res.data
            });
          }
        },
        fail(err) {
          // reject(err);
          // uni.request 的 fail 回调会提供一个包含 errMsg 的对象
          // console.error('!!!!!!!!!! [Adapter.fail] Request failed at network level !!!!!!!!!');
          // console.error('[Adapter.fail] Raw error object:', err);
          // 将 uni-app 的错误对象转换成标准的 Error 对象
          const error = new Error(err.errMsg || 'uni.request failed');
          reject(error);
        },
        complete(err) {
          if (!err || !err.errMsg) {
            return;
          }
          if (!self._timeout ||
              self._restrictedMethods.indexOf("post") === -1
          ) {
            return;
          }
          const {errMsg} = err;
          // uniapp 不同平台超时信息可能不一致，使用 includes 更稳妥
          if (errMsg.includes("timeout")) {
            console.warn(self._timeoutMsg);
            try {
              task.abort();
            } catch (e) {
              // FIX: 增加中止任务失败时的警告，而不是静默处理
              console.warn(TASK_ABORT_ERROR_MSG, e);
            }
          }
        }
      });
    });
  }

  // 测试成功
  upload(options: IUploadRequestOptions) {
    const self = this;
    console.log('[Adapter.upload] Entered Promise. options:', options);
    return new Promise(async resolve => {
      const {
        url,
        file,
        data,
        headers,
        onUploadProgress
      } = options;
      const task = uni.uploadFile({
        url: url,
        filePath: file,
        // 固定字段
        name: 'file',
        formData: data || {},
        header: headers,
        timeout: this._timeout,
        success(res) {
          // console.log('--- [Adapter.upload] Entered Promise. options.data:', options.data);
          // console.log('[Adapter.upload] Raw response:', res);
          const result = {
            statusCode: res.statusCode,
            data: res.data || {}
          };
          // 200转化为201（如果指定）
          if (res.statusCode === 200 && data.success_action_status) {
            result.statusCode = parseInt(data.success_action_status, 10);
          }
          // console.log('--- [Adapter.upload] Upload success. Result:', result);
          resolve(result);
        },
        fail(err) {
          resolve(err);
        },
        complete(err){
          if(!err||!err.errMsg){
            return;
          }
          if(!self._timeout || self._restrictedMethods.indexOf('upload') === -1){
            return;
          }
          const { errMsg } = err;
          if(errMsg==='request:fail timeout'){
            console.warn(self._timeoutMsg);
            try{
              task.abort();
            }catch(e){}
          }
        }
      });
      if(onUploadProgress){
        task.onProgressUpdate(res=>{
          onUploadProgress(res);
        });
      }
    });
  }

  // 测试成功，但是会有警告：Refused to get unsafe header "content disposition"
  download(options: IRequestOptions) {
    const self = this;
    return new Promise((resolve, reject) => {
      const { url, headers } = options;
      const task = uni.downloadFile({
        url: formatUrl('https:', url),
        header: headers,
        timeout: this._timeout,
        success(res) {
          console.log('[Adapter.download] Raw response:', res);
          if (res.statusCode === 200 && res.tempFilePath) {
            // 由于涉及权限问题，只返回临时链接不保存到设备
            resolve({
              statusCode: 200,
              tempFilePath: res.tempFilePath
            });
          } else {
            resolve(res);
          }
        },
        fail(err) {
          reject(err);
        },
        complete(err){
          if(!err||!err.errMsg){
            return;
          }
          if(!self._timeout || self._restrictedMethods.indexOf('download') === -1){
            return;
          }
          const { errMsg } = err;
          if(errMsg.includes('timeout')){
            console.warn(self._timeoutMsg);
            try{
              task.abort();
            }catch(e){}
          }
        }
      })
    })
  }

  fetch(options: IFetchOptions) {
    console.log("[Adapter.fetch] Entered fetch method with options:", options);
    const {
      url,
      body,
      enableAbort,
      headers,
      method,
      stream: shouldStream = false,
      signal,
      timeout: _timeout
    } = options;

    const self = this;

    const timeout = _timeout ?? this._timeout; 

    // controller 用于 ReadableStream 的控制
    let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
    const stream = new ReadableStream({
      start(c) {
        controller = c;
      },
      cancel() {
        controller = null;
      },
    });
    return new Promise((resolve, reject) => {
      shouldStream && resolve({ data: stream });

      const task = uni.request({
        url: formatUrl("https:", url),
        data: body,
        timeout: timeout,
        method: method.toUpperCase(),
        header: headers,
        success(res) {
          controller?.close();
          !shouldStream && resolve(res);
        },
        fail(err) {
          controller?.close();
          reject(err);
          if (shouldStream) {
            throw err;
          }
        },
        complete(err) {
          if (!err || !err.errMsg) {
            return;
          }
          if (
            // !timeout ||
            // self._restrictedMethods.indexOf("post") === -1 ||
            // !enableAbort
            !timeout ||
            // FIX: 根据当前请求的 method 判断，而不是写死 'post'
            self._restrictedMethods.indexOf(method.toLowerCase() as IRequestMethod) === -1 ||
            !enableAbort
          ) {
            return;
          }
          const { errMsg } = err;
          if (errMsg.includes("timeout")) {
            console.warn(self._timeoutMsg);
            try {
              task.abort();
            } catch (e) {
              console.warn(TASK_ABORT_ERROR_MSG, e);
            }
          }
        },
        enableChunked: shouldStream,
      });
        // 处理流式数据接收
      if(shouldStream && typeof task.onChunkReceived === 'function') {
        task.onChunkReceived((res: {data:ArrayBuffer})=>{
          controller?.enqueue(new Uint8Array(res.data)); // 坑：开发者工具 data 是 Uint8Array；真机上是 ArrayBuffer
        })
      } else if(shouldStream){
        console.warn("[Adapter.fetch] onChunkReceived is not supported in this environment. Streaming will not work.");
      }

      if (signal) {
        const abort = () => {
          try {
            task.abort();
          } catch (e) {
            console.warn(TASK_ABORT_ERROR_MSG, e);
          }
        };
        
        if (signal.aborted) {
          abort();
        } else {
          signal.addEventListener("abort", () => abort());
        }
      }
    });
  }
}

export const uniStorage: StorageInterface = {
  setItem(key: string, value: any) {
    uni.setStorageSync(key, value);
  },
  getItem(key: string): any {
    return uni.getStorageSync(key);
  },
  removeItem(key: string) {
    uni.removeStorageSync(key);
  },
  clear() {
    uni.clearStorageSync();
  }
};

// 兼容 uniapp 的 WebSocket 接口，测试成功
export class UniWebSocket {
  // 定义 WebSocket 状态常量
  CONNECTING = 0;
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;

  constructor(url: string, options: object = {}) {
    // console.log('[UniWebSocket] Initializing WebSocket with URL:', url, 'and options:', options);
    let uniws = uni.connectSocket({
      url,
      ...options,
      complete: () => {}
    });
    // console.log('uniws:', uniws);
    console.log('[UniWebSocket] WebSocket task created:', uniws);

    const socketTask: WebSocketInterface = {
      set onopen(cb) {
        uniws.onOpen(cb);
      },
      set onmessage(cb) {
        uniws.onMessage(cb);
      },
      set onclose(cb) {
        uniws.onClose(cb);
      },
      set onerror(cb) {
        uniws.onError(cb);
      },
      send: (data) => uniws.send({ data }),
      close: (code? : number, reason? : string) => {
        return uniws.close({
          code,
          reason
        });
      },
      get readyState() {
        // 注意：uniapp 的 connectSocketTask 没有官方的 readyState 属性
        return uniws.readyState;
      },

      CONNECTING: this.CONNECTING,
      OPEN: this.OPEN,
      CLOSING: this.CLOSING,
      CLOSED: this.CLOSED
    };
    return socketTask;
  }
}

function genAdapter() {
  // 小程序无sessionStorage
  const adapter: SDKAdapterInterface = {
    root: {},
    reqClass: UniRequest,
    wsClass: UniWebSocket as WebSocketContructor,
    localStorage: uniStorage,
    primaryStorage: StorageType.local,
    getAppSign(){
      // uni.getAccountInfoSync() 在多端环境下可用
      const info = uni.getAccountInfoSync();
      if(isPlugin()){
        // 插件环境返回插件appid
        return info&&info.plugin?info.plugin.appId:'';
      }else{
        return info&&info.miniProgram?info.miniProgram.appId:'';
      }
    }
  };
  return adapter;
}

const adapter = {
  genAdapter,
  isMatch,
  runtime: 'uniapp'
};

export default adapter;