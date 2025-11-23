type ResolveFn<T> = (value: T | PromiseLike<T>) => void;
type RejectFn = (reason?: unknown) => void;
type Executor<T> = (resolveFunc: ResolveFn<T>, rejectFunc: RejectFn) => unknown;
type OnFulfilled<T, R> = (value: T) => R | PromiseLike<R>;
type OnFulfilledOrNull<T, R> = OnFulfilled<T, R> | null | undefined;
type OnRejected<R> = (reason: unknown) => R | PromiseLike<R>;
type OnRejectedOrNull<R> = OnRejected<R> | null | undefined;
type FinallyHandler = () => unknown;

const State = {
  PENDING: 0,
  FULFILLED: 1,
  REJECTED: 2,
};

clas Promise<T = unknown> {
  #state: number = State.PENDING;
  #data: T | undefined = undefined;
  #reason: unknown = undefined;
  #onResolvedCallbacks: Array<(value: T) => void> = [];
  #onRejectedCallbacks: Array<(reason: unknown) => void> = [];

  constructor(executor: Executor<T>) {
    try {
      executor(
        (data) => this.#resolvePromise(data),
        (reason) => this.#reject(reason),
      );
    } catch (error) {
      this.#reject(error);
    }
  }
  static resolve<T>(value: T | PromiseLike<T>) {
    return new Promise<T>((resolve) => resolve(value));
  }
  static reject(reason: unknown) {
    return new Promise<never>((_resolve, reject) => reject(reason));
  }
  static race<T>(promises: Iterable<T | PromiseLike<T>>) {
    return new Promise<T>((resolve, reject) => {
      for (const promise of promises) {
        Promise.resolve(promise).then(resolve, reject);
      }
    });
  }
  static allSettled<T>(promises: Iterable<T | PromiseLike<T>>) {
    return new Promise<Array<PromiseSettledResult<T>>>((resolve) => {
      const result: Array<PromiseSettledResult<T>> = [];
      let count = 0;
      let size = 0;
      for (const promise of promises) {
        const index = size++;
        Promise.resolve(promise).then(
          (data: T) => {
            result[index] = { status: "fulfilled", value: data };
            if (++count === size) {
              resolve(result);
            }
          },
          (reason: unknown) => {
            result[index] = { status: "rejected", reason };
            if (++count === size) {
              resolve(result);
            }
          },
        );
      }
      if (size === count) {
        resolve(result);
      }
    });
  }
  static all<T>(promises: Iterable<T | PromiseLike<T>>) {
    return new Promise<T[]>((resolve, reject) => {
      const result: T[] = [];
      let count = 0;
      let size = 0;
      for (const promise of promises) {
        const index = size++;
        Promise.resolve(promise).then(
          (data: T) => {
            result[index] = data;
            if (++count === size) {
              resolve(result);
            }
          },
          (error: unknown) => reject(error),
        );
      }
      if (size === count) {
        resolve(result);
      }
    });
  }
  then<TResult1 = T, TResult2 = never>(
    onFulfilled?: OnFulfilledOrNull<T, TResult1>,
    onRejected?: OnRejectedOrNull<TResult2>,
  ) {
    const onFulfilledFunc: OnFulfilled<T, TResult1> =
      typeof onFulfilled === "function" ? onFulfilled : (v) => v as unknown as TResult1;

    const onRejectedFunc: OnRejected<TResult2> =
      typeof onRejected === "function"
        ? onRejected
        : (r) => {
            throw r;
          };
    return new Promise<TResult1 | TResult2>((resolve, reject) => {
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
  catch<TResult = never>(onRejected?: OnRejectedOrNull<TResult>) {
    return this.then(undefined, onRejected);
  }
  finally(onFinally: FinallyHandler) {
    return new Promise<T>((resolve, reject) => {
      this.then(
        (value: T) => {
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
        (reason: unknown) => {
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
  #resolve(data: T) {
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
  #resolvePromise(x: T | PromiseLike<T> | Promise<T> | unknown) {
    if (x === this) {
      this.#reject(new TypeError("Chaining cycle detected for promise!"));
    } else if (x instanceof Promise) {
      if (x.#state === State.PENDING) {
        x.#onResolvedCallbacks.push((value) => this.#resolvePromise(value));
        x.#onRejectedCallbacks.push((reason) => this.#reject(reason));
      } else if (x.#state == State.FULFILLED) {
        this.#resolve(x.#data as T);
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
              this.#resolvePromise(y as T);
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
        this.#resolve(x as T);
      }
    } else {
      this.#resolve(x as T);
    }
  }
}
function resolved<T>(value: T) {
  return new Promise<T>((resolve) => resolve(value));
}
function rejected(reason: unknown) {
  return new Promise<never>((_resolve, reject) => reject(reason));
}
function deferred<T>() {
  const deferred: {
    promise?: Promise<T>;
    resolve?: ResolveFn<T>;
    reject?: RejectFn;
  } = {};
  deferred.promise = new Promise<T>((resolve, reject) => {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred as {
    promise: Promise<T>;
    resolve: ResolveFn<T>;
    reject: RejectFn;
  };
}
export {
  resolved,
  rejected,
  deferred,
};
