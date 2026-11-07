/** Solve A x = b for a symmetric positive-definite matrix (Cholesky). A is n*n row-major. */
export function solveSPD(A: Float64Array, b: Float64Array, n: number): Float64Array {
  const L = new Float64Array(n * n)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i * n + j]
      for (let k = 0; k < j; k++) sum -= L[i * n + k] * L[j * n + k]
      if (i === j) {
        L[i * n + i] = Math.sqrt(Math.max(sum, 1e-12))
      } else {
        L[i * n + j] = sum / L[j * n + j]
      }
    }
  }
  const y = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    let sum = b[i]
    for (let k = 0; k < i; k++) sum -= L[i * n + k] * y[k]
    y[i] = sum / L[i * n + i]
  }
  const x = new Float64Array(n)
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i]
    for (let k = i + 1; k < n; k++) sum -= L[k * n + i] * x[k]
    x[i] = sum / L[i * n + i]
  }
  return x
}

/**
 * Minimum weighted norm with equality constraints and bounds on some variables:
 *   minimise  sum_j (x_j / w_j)^2   subject to  A x = b,
 *             x_j >= 0 for j in nonNeg,   x_j <= upper_j where upper_j is finite.
 * A is m*n row-major (m constraints). With the bounded variables held at their bounds, the
 * free variables have the closed form x = W A^T (A W A^T)^-1 b' with W = diag(w^2). An
 * active-set loop fixes the worst bound violation, or releases a fixed variable whose
 * Lagrange multiplier shows the cost would drop, until the KKT conditions hold.
 * Unconstrained variables (reserves) keep the system solvable.
 */
export function weightedMinNorm(
  A: Float64Array,
  b: Float64Array,
  m: number,
  n: number,
  w: Float64Array,
  nonNeg: Uint8Array,
  upper?: Float64Array,
  ridge = 1e-9,
  maxIter = 600,
): Float64Array {
  const FREE = 0
  const LOWER = 1
  const UPPER = 2
  const state = new Uint8Array(n) // all free
  const ub = (j: number) => (upper ? upper[j] : Infinity)
  const W = new Float64Array(n)
  let x: Float64Array = new Float64Array(n)
  let lambda: Float64Array = new Float64Array(m)
  const rhs = new Float64Array(m)

  const solve = () => {
    rhs.set(b)
    for (let j = 0; j < n; j++) {
      W[j] = state[j] === FREE ? w[j] * w[j] : 0
      if (state[j] === UPPER) {
        const u = ub(j)
        for (let r = 0; r < m; r++) rhs[r] -= A[r * n + j] * u
      }
    }
    const M = new Float64Array(m * m)
    for (let r = 0; r < m; r++) {
      const ro = r * n
      for (let c = 0; c <= r; c++) {
        const co = c * n
        let sum = 0
        for (let j = 0; j < n; j++) {
          const wj = W[j]
          if (wj !== 0) {
            const ar = A[ro + j]
            if (ar !== 0) sum += ar * wj * A[co + j]
          }
        }
        M[r * m + c] = sum
        M[c * m + r] = sum
      }
    }
    let trace = 0
    for (let r = 0; r < m; r++) trace += M[r * m + r]
    const eps = ridge * (trace / m + 1e-12)
    for (let r = 0; r < m; r++) M[r * m + r] += eps
    lambda = solveSPD(M, rhs, m)
    x = new Float64Array(n)
    for (let j = 0; j < n; j++) {
      if (state[j] === UPPER) {
        x[j] = ub(j)
        continue
      }
      if (!W[j]) continue
      let sum = 0
      for (let r = 0; r < m; r++) sum += A[r * n + j] * lambda[r]
      x[j] = W[j] * sum
    }
  }
  const multiplier = (j: number) => {
    let g = 0
    for (let r = 0; r < m; r++) g += A[r * n + j] * lambda[r]
    return g
  }

  solve()
  for (let iter = 0; iter < maxIter; iter++) {
    // 1. Fix the worst bound violation among free variables (several negatives at once on
    //    the first passes to speed things up; step 2 repairs over-eager fixes).
    let worst = -1
    let worstVal = 0
    let worstState = FREE
    let negatives = 0
    for (let j = 0; j < n; j++) {
      if (state[j] !== FREE) continue
      if (nonNeg[j] && x[j] < 0) {
        negatives++
        const v = -x[j] / w[j]
        if (v > worstVal) {
          worstVal = v
          worst = j
          worstState = LOWER
        }
      } else if (x[j] > ub(j)) {
        const v = (x[j] - ub(j)) / w[j]
        if (v > worstVal) {
          worstVal = v
          worst = j
          worstState = UPPER
        }
      }
    }
    if (worst >= 0) {
      if (iter < 3 && negatives > 4) {
        for (let j = 0; j < n; j++) if (state[j] === FREE && nonNeg[j] && x[j] < 0) state[j] = LOWER
      } else {
        state[worst] = worstState
      }
      solve()
      continue
    }
    // 2. Release the fixed variable that most wants to move back into the interior.
    let best = -1
    let bestVal = 1e-9
    for (let j = 0; j < n; j++) {
      if (state[j] === FREE) continue
      const g = multiplier(j)
      // At zero: would grow if g > 0. At the upper bound: its unconstrained value w^2 g is
      // below the bound, so it would rather shrink.
      const v = state[j] === LOWER ? g * w[j] : (ub(j) - w[j] * w[j] * g) / w[j]
      if (v > bestVal) {
        bestVal = v
        best = j
      }
    }
    if (best < 0) break
    state[best] = FREE
    solve()
  }
  for (let j = 0; j < n; j++) {
    if (nonNeg[j] && x[j] < 0) x[j] = 0
    if (x[j] > ub(j)) x[j] = ub(j)
  }
  return x
}
