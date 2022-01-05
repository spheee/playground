/**
 * js引擎为了让microtask尽快的输出，做了一些优化，连续的多个then(3个)如果没有reject或者resolve会交替执行then而不至于让一个堵太久完成用户无响应
 * 不单单v8这样其他引擎也是这样，因为其实promise内部状态已经结束了。这块在v8源码里有完整的体现.
 * 这就是连续 then 不能按照既定顺序执行的原因 也是经常令新手判断出错的诱因
 */
// 先定义三个常量表示状态
const PENDING = 'pending'
const FULFILLED = 'fulfilled'
const REJECTED = 'rejected'

class CustomPromise {
  // Promise 构造器主要用于包装不支持promise（返回值不是Promise）的函数。
  constructor(executor) {
    // executor 是一个执行器，进入会立即执行
    // 分别对promise执行resolve和reject
    try {
      executor(this.resolve, this.reject)
    } catch (e) {
      this.reject(e)
    }
  }
  status = PENDING
  // resolve reject 目标执行环境在执行器中
  // 箭头函数不改变 this 指向，所以当前 this 指向当前
  resolve = (value) => {
    // 状态为等待，执行状态修改
    if (this.status === PENDING) {
      // 状态修改为成功
      this.status = FULFILLED
      // 保存成功之后的值
      this.value = value
      // 判断成功回调是否存在，如果存在就调用
      while (this.onFulfilledCallback.length) {
        this.onFulfilledCallback.shift()(value)
      }
      //   this.onFulfilledCallback && this.onFulfilledCallback(value)
    }
  }
  reject = (reason) => {
    // 状态为等待，执行状态修改
    if (this.status === PENDING) {
      // 状态修改为成功
      this.status = REJECTED
      // 保存失败的原因
      this.reason = reason
      // 判断失败回调是否存在，如果存在就调用
      while (this.onRejectedCallback.length) {
        this.onRejectedCallback.shift()(reason)
      }
    }
  }
  then(onFulfilled, onRejected) {
    const realOnFulfilled =
      typeof onFulfilled === 'function' ? onFulfilled : (value) => value
    const realOnRejected =
      typeof onRejected === 'function'
        ? onRejected
        : (reason) => {
            throw reason
          }

    // 考虑到链式调用 then 需要返回一个 promise 实例
    const promise = new CustomPromise((resolve, reject) => {
      const fulfill = () => {
        queueMicrotask(() => {
          try {
            // 获取成功回调函数的执行结果
            const fulfillPromise = realOnFulfilled(this.value)

            resolvePromise(promise, fulfillPromise, resolve, reject)
          } catch (error) {
            reject(error)
          }
        })
      }
      const reject = () => {
        queueMicrotask(() => {
          try {
            // 获取成功回调函数的执行结果
            const rejectPromise = realOnRejected(this.reason)
            resolvePromise(promise, rejectPromise, resolve, reject)
          } catch (error) {
            reject(error)
          }
        })
      }

      // 此处为新的执行器，立即执行 判断状态
      if (this.status === FULFILLED) {
        fulfill()
      } else if (this.status === REJECTED) {
        reject()
      } else if (this.status === PENDING) {
        // 因为不知道后面状态的变化情况，所以将成功回调和失败回调存储起来
        // 等到执行成功失败函数的时候再传递
        this.onFulfilledCallback.push(onFulfilled)
        this.onRejectedCallback.push(onRejected)
      }
    })
    return promise
  }
  //TODO: 实现
  catch(){}

  finally(){

  }

  // 存储成功回调函数
  onFulfilledCallback = []
  // 存储失败回调函数
  onRejectedCallback = []

  // 成功返回的值
  value = null
  // 失败的原因
  reason = null

  // resolve 静态方法
  static resolve(parameter) {
    // 如果传入 CustomPromise 就直接返回
    if (parameter instanceof CustomPromise) {
      return parameter
    }

    // 转成常规方式
    return new CustomPromise((resolve) => {
      resolve(parameter)
    })
  }

  // reject 静态方法
  static reject(reason) {
    return new CustomPromise((resolve, reject) => {
      reject(reason)
    })
  }
  // TODO: 实现
  // 其实 all 和 allSettled 的区别非常简单，就在于传入的 Promise 数组能否被执行完
  // all 遇到 reject 会直接断出 然而 allSettled 不会。对照 Array 的几个循环方法可迅速得知 Array.prototype.forEach 不会断出
  static all(){

  }
  static allSettled() {}

  static any(){}

  static race(){}

  static reject(){

  }
}
function resolvePromise(promise, promiseResult, resolve, reject) {
  // 如果相等了，说明return的是自己，抛出类型错误并返回
  // 否则会导致死循环
  if (promise === promiseResult) {
    return reject(
      new TypeError('Chaining cycle detected for promise #<Promise>')
    )
  }
  if (typeof promiseResult === 'object' || typeof x === 'function') {
    // promiseResult 为 null 直接返回，走后面的逻辑会报错
    if (x === null) {
      return resolve(x)
    }

    let then
    try {
      // 把 promiseResult.then 赋值给 then
      then = promiseResult.then
    } catch (error) {
      // 如果取 promiseResult.then 的值时抛出错误 error ，则以 error 为据因拒绝 promise
      return reject(error)
    }

    // 如果 then 是函数
    if (typeof then === 'function') {
      let called = false
      try {
        then.call(
          promiseResult, // this 指向 promiseResult
          // 如果 resolvePromise 以值 y 为参数被调用，则运行 [[Resolve]](promise, y)
          (y) => {
            // 如果 resolvePromise 和 rejectPromise 均被调用，
            // 或者被同一参数调用了多次，则优先采用首次调用并忽略剩下的调用
            // 实现这条需要前面加一个变量 called
            if (called) return
            called = true
            resolvePromise(promise, y, resolve, reject)
          },
          // 如果 rejectPromise 以据因 r 为参数被调用，则以据因 r 拒绝 promise
          (r) => {
            if (called) return
            called = true
            reject(r)
          }
        )
      } catch (error) {
        // 如果调用 then 方法抛出了异常 error：
        // 如果 resolvePromise 或 rejectPromise 已经被调用，直接返回
        if (called) return

        // 否则以 error 为据因拒绝 promise
        reject(error)
      }
    } else {
      // 如果 then 不是函数，以 promiseResult 为参数执行 promise
      resolve(promiseResult)
    }
  } else {
    // 如果 promiseResult 不为对象或者函数，以 promiseResult 为参数执行 promise
    resolve(promiseResult)
  }
}

