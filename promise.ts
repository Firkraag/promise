type FuncType = (value: unknown) => unknown;

const State = {
  PENDING: 0,
  FULFILLED: 1,
  REJECTED: 2,
};
class Promise {
  #state: number = State.PENDING;
  #data: unknown = undefined;
  #reason: unknown = undefined;
  #onResolvedCallbacks: FuncType[]= [];
  #onRejectedCallbacks: FuncType[] = [];

  constructor(executor: (
        resolveFunc: FuncType,
        rejectFunc: FuncType,
  ) => unknown) {
    try {
      executor(
        (data ) => this.#resolvePromise(data),
        (reason) => this.#reject(reason),
      );
    } catch (error) {
      this.#reject(error);
    }
  }
  static resolve(value: unknown) {
    return new Promise((resolve) => resolve(value));
  }
  static reject(reason: unknown) {
    return new Promise((_resolve, reject) => reject(reason));
  }
  static race(promises: Iterable<unknown>) {
    return new Promise((resolve, reject) => {
      for (const promise of promises) {
        if (promise instanceof Promise) {
          promise.then(resolve, reject);
        } else {
          resolve(promise);
        }
      }
    });
  }
  static allSettled(promises: Iterable<unknown>) {
    return new Promise((resolve) => {
      type Result = {
        status: 'fulfilled' | 'rejected',
        value?: unknown,
        reason?: unknown,
      }
      const result: Result[] = [];
      let count = 0;
      let size = 0;
      for (const promise of promises) {
        if (!(promise instanceof Promise)) {
          result[size++] = { status: "fulfilled", value: promise };
          count++;
        } else {
          const index = size++;
          promise.then(
            (data: unknown) => {
              result[index] = { status: "fulfilled", value: data };
              if (++count === size) {
                resolve(result);
              }
            },
            (reason: unknown) => {
              result[index] = { status: "rejected", reason: reason };
              if (++count === size) {
                resolve(result);
              }
            },
          );
        }
      }
      if (size === count) {
        resolve(result);
      }
    });
  }
  static all(promises: Iterable<unknown>) {
    return new Promise((resolve, reject) => {
      const result: unknown[] = [];
      let count = 0;
      let size = 0;
      for (const promise of promises) {
        if (!(promise instanceof Promise)) {
          result[size++] = promise;
          count++;
        } else {
          const index = size++;
          promise.then(
            (data: unknown) => {
              result[index] = data;
              if (++count === size) {
                resolve(result);
              }
            },
            (error: unknown) => {
              reject(error);
            },
          );
        }
      }
      if (size === count) {
        resolve(result);
      }
    });
  }
  then(onFulfilled: unknown, onRejected: unknown) {
    const onFulfilledFunc: FuncType = typeof onFulfilled === "function" ? onFulfilled as FuncType : (v) => v;

    const onRejectedFunc: FuncType =
      typeof onRejected === "function"
        ? onRejected as FuncType
        : (r) => {
            throw r;
          };
    return new Promise((resolve, reject) => {
      this.#onResolvedCallbacks.push((value) => {
        try {
          const x = onFulfilledFunc(value);
          resolve(x);
        } catch (error) {
          reject(error);
        }
      });
      this.#onRejectedCallbacks.push((reason) => {
        try {
          const x = onRejectedFunc(reason);
          resolve(x);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
  catch(onRejected: unknown) {
    return this.then(undefined, onRejected);
  }
  finally(onFinally: () => unknown) {
    return new Promise((resolve, reject) => {
      this.then(
        (value: unknown) => {
          try {
            const v = onFinally();
            if (v instanceof Promise) {
              v.then(
                () => resolve(value),
                (reason: unknown) => reject(reason),
              );
            } else {
              resolve(value);
            }
          } catch (error) {
            reject(error);
          }
        },
        (reason: unknown) => {
          try {
            const v = onFinally();
            if (v instanceof Promise) {
              v.then(
                () => reject(reason),
                (r: unknown) => reject(r),
              );
            } else {
              reject(reason);
            }
          } catch (error) {
            reject(error);
          }
        },
      );
    });
  }
  #resolve(data: unknown) {
    setTimeout(() => {
      if (this.#state === State.PENDING) {
        this.#state = State.FULFILLED;
        this.#data = data;
        for (const callback of this.#onResolvedCallbacks) {
          callback(data);
        }
      }
    }, 0);
  }
  #reject(reason: unknown) {
    setTimeout(() => {
      if (this.#state === State.PENDING) {
        this.#state = State.REJECTED;
        this.#reason = reason;
        for (const callback of this.#onRejectedCallbacks) {
          callback(reason);
        }
      }
    }, 0);
  }
  #resolvePromise(x: unknown) {
    if (x === this) {
      this.#reject(new TypeError("Chaining cycle detected for promise!"));
    } else if (x instanceof Promise) {
      if (x.#state === State.PENDING) {
        x.#onResolvedCallbacks.push((value) => this.#resolvePromise(value));
        x.#onRejectedCallbacks.push((reason) => this.#reject(reason));
      } else if (x.#state == State.FULFILLED) {
        this.#resolve(x.#data);
      } else {
        this.#reject(x.#reason);
      }
    } else if (
      x !== null &&
      (typeof x === "object" || typeof x === "function")
    ) {
      let then: unknown = undefined;
      try {
        then = (x as any).then;
      } catch (error) {
        this.#reject(error);
        return;
      }
      if (typeof then === "function") {
        let called = false;
        try {
          then.call(
            x,
            (y: unknown) => {
              if (called) return;
              called = true;
              this.#resolvePromise(y);
            },
            (r: unknown) => {
              if (called) return;
              called = true;
              this.#reject(r);
            },
          );
        } catch (error) {
          if (called) return;
          this.#reject(error);
        }
      } else {
        this.#resolve(x);
      }
    } else {
      this.#resolve(x);
    }
  }
}
function resolved(value: unknown) {
  return new Promise((resolve) => resolve(value));
}
function rejected(reason: unknown) {
  return new Promise((_resolve, reject) => reject(reason));
}
function deferred() {
  const deferred: {
    promise?: Promise;
    resolve?: FuncType;
    reject?: FuncType;
  } = {};
  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
}
export {
  resolved,
  rejected,
  deferred,
};
