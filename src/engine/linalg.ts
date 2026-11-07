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
 * Minimum weighted norm with equality constraints and non-negativity on some variables:
 *   minimise  sum_j (x_j / w_j)^2   subject to  A x = b,  x_j >= 0 for j in nonNeg.
 * A is m*n row-major (m constraints). Each sub-problem has the closed form
 * x = W A^T (A W A^T)^-1 b with W = diag(w^2) over the free variables. An active-set loop
 * releases the most negative variable, or re-admits a variable whose Lagrange multiplier
 * shows it would lower the cost, until the KKT conditions hold. Unconstrained variables
 * (reserves) keep the system well-posed.
 */
export function weightedMinNorm(
  A: Float64Array,
  b: Float64Array,
  m: number,
  n: number,
  w: Float64Array,
  nonNeg: Uint8Array,
  ridge = 1e-9,
  maxIter = 80,
): Float64Array {
  const active = new Uint8Array(n).fill(1)
  const W = new Float64Array(n)
  let x: Float64Array = new Float64Array(n)
  let lambda: Float64Array = new Float64Array(m)

  const solve = () => {
    for (let j = 0; j < n; j++) W[j] = active[j] ? w[j] * w[j] : 0
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
    lambda = solveSPD(M, b, m)
    x = new Float64Array(n)
    for (let j = 0; j < n; j++) {
      if (!W[j]) continue
      let sum = 0
      for (let r = 0; r < m; r++) sum += A[r * n + j] * lambda[r]
      x[j] = W[j] * sum
    }
  }

  solve()
  for (let iter = 0; iter < maxIter; iter++) {
    // 1. Drop the most negative constrained variable(s). Dropping several at once early on
    //    speeds things up; the re-admission step below repairs any over-eager drops.
    let worst = -1
    let worstVal = 0
    let negatives = 0
    for (let j = 0; j < n; j++) {
      if (nonNeg[j] && active[j] && x[j] < 0) {
        negatives++
        const v = x[j] / w[j]
        if (v < worstVal) {
          worstVal = v
          worst = j
        }
      }
    }
    if (worst >= 0) {
      if (iter < 3 && negatives > 4) {
        for (let j = 0; j < n; j++) if (nonNeg[j] && active[j] && x[j] < 0) active[j] = 0
      } else {
        active[worst] = 0
      }
      solve()
      continue
    }
    // 2. Re-admit the inactive variable with the largest positive multiplier A_j^T lambda.
    let best = -1
    let bestVal = 1e-9
    for (let j = 0; j < n; j++) {
      if (active[j]) continue
      let g = 0
      for (let r = 0; r < m; r++) g += A[r * n + j] * lambda[r]
      const v = g * w[j]
      if (v > bestVal) {
        bestVal = v
        best = j
      }
    }
    if (best < 0) break
    active[best] = 1
    solve()
  }
  for (let j = 0; j < n; j++) if (nonNeg[j] && x[j] < 0) x[j] = 0
  return x
}
