const State = {
  PENDING: 0,
  FULFILLED: 1,
  REJECTED: 2,
};
class Promise {
  #state = State.PENDING;
  #data = undefined;
  #reason = undefined;
  #onResolvedCallbacks = [];
  #onRejectedCallbacks = [];

  constructor(executor) {
    try {
      executor(
        (data) => this.#resolvePromise(data),
        (reason) => this.#reject(reason),
      );
    } catch (error) {
      this.#reject(error);
    }
  }
  static resolve(value) {
    return new Promise((resolve) => resolve(value));
  }
  static reject(reason) {
    return new Promise((_resolve, reject) => reject(reason));
  }
  static race(promises) {
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
  static allSettled(promises) {
    return new Promise((resolve) => {
      const result = [];
      let count = 0;
      let size = 0;
      for (const promise of promises) {
        if (!(promise instanceof Promise)) {
          result[size++] = { status: "fulfilled", value: promise };
          count++;
        } else {
          const index = size++;
          promise.then(
            (data) => {
              result[index] = { status: "fulfilled", value: data };
              if (++count === size) {
                resolve(result);
              }
            },
            (reason) => {
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
  static all(promises) {
    return new Promise((resolve, reject) => {
      const result = [];
      let count = 0;
      let size = 0;
      for (const promise of promises) {
        if (!(promise instanceof Promise)) {
          result[size++] = promise;
          count++;
        } else {
          const index = size++;
          promise.then(
            (data) => {
              result[index] = data;
              if (++count === size) {
                resolve(result);
              }
            },
            (error) => {
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
  then(onFulfilled, onRejected) {
    onFulfilled = typeof onFulfilled === "function" ? onFulfilled : (v) => v;
    onRejected =
      typeof onRejected === "function"
        ? onRejected
        : (r) => {
            throw r;
          };
    return new Promise((resolve, reject) => {
      this.#onResolvedCallbacks.push((value) => {
        try {
          const x = onFulfilled(value);
          resolve(x);
        } catch (error) {
          reject(error);
        }
      });
      this.#onRejectedCallbacks.push((reason) => {
        try {
          const x = onRejected(reason);
          resolve(x);
        } catch (error) {
          reject(error);
        }
      });
    });
  }
  catch(onRejected) {
    return this.then(undefined, onRejected);
  }
  finally(onFinally) {
    return new Promise((resolve, reject) => {
      this.then(
        (value) => {
          try {
            const v = onFinally();
            if (v instanceof Promise) {
              v.then(
                () => resolve(value),
                (reason) => reject(reason),
              );
            } else {
              resolve(value);
            }
          } catch (error) {
            reject(error);
          }
        },
        (reason) => {
          try {
            const v = onFinally();
            if (v instanceof Promise) {
              v.then(
                () => reject(reason),
                (r) => reject(r),
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
  #resolve(data) {
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
  #reject(reason) {
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
  #resolvePromise(x) {
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
      let then = undefined;
      try {
        then = x.then;
      } catch (error) {
        this.#reject(error);
        return;
      }
      if (typeof then === "function") {
        let called = false;
        try {
          then.call(
            x,
            (y) => {
              if (called) return;
              called = true;
              this.#resolvePromise(y);
            },
            (r) => {
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
function resolved(value) {
  return new Promise((resolve) => resolve(value));
}
function rejected(reason) {
  return new Promise((_resolve, reject) => reject(reason));
}
function deferred() {
  const deferred = {};
  deferred.promise = new Promise((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
}
module.exports = {
  resolved,
  rejected,
  deferred,
};
