type CompareFn<T> = (a: T, b: T) => number;

export default function quickselect<T>(
  arr: T[],
  k: number,
  left = 0,
  right = arr.length - 1,
  compare: CompareFn<T> = defaultCompare
): void {
  quickselectStep(arr, k, left, right, compare);
}

function quickselectStep<T>(arr: T[], k: number, left: number, right: number, compare: CompareFn<T>): void {
  while (right > left) {
    if (right - left > 600) {
      const n = right - left + 1;
      const m = k - left + 1;
      const z = Math.log(n);
      const s = 0.5 * Math.exp((2 * z) / 3);
      const sd = 0.5 * Math.sqrt((z * s * (n - s)) / n) * (m - n / 2 < 0 ? -1 : 1);
      const newLeft = Math.max(left, Math.floor(k - (m * s) / n + sd));
      const newRight = Math.min(right, Math.floor(k + ((n - m) * s) / n + sd));
      quickselectStep(arr, k, newLeft, newRight, compare);
    }

    const t = arr[k];
    let i = left;
    let j = right;

    swap(arr, left, k);
    if (compare(arr[right], t) > 0) {
      swap(arr, left, right);
    }

    while (i < j) {
      swap(arr, i, j);
      i++;
      j--;
      while (compare(arr[i], t) < 0) {
        i++;
      }
      while (compare(arr[j], t) > 0) {
        j--;
      }
    }

    if (compare(arr[left], t) === 0) {
      swap(arr, left, j);
    } else {
      j++;
      swap(arr, j, right);
    }

    if (j <= k) {
      left = j + 1;
    }
    if (k <= j) {
      right = j - 1;
    }
  }
}

function swap<T>(arr: T[], i: number, j: number): void {
  const tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
}

function defaultCompare<T>(a: T, b: T): number {
  const leftValue = a as string | number | bigint | boolean;
  const rightValue = b as string | number | bigint | boolean;

  if (leftValue < rightValue) {
    return -1;
  }
  if (leftValue > rightValue) {
    return 1;
  }
  return 0;
}