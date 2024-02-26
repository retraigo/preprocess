import {
  DataType,
  getDataType,
  DType,
  DTypeConstructor,
  DTypeValue,
  AddDTypeValues,
  Sliceable,
} from "../common_types.ts";
import { getConstructor } from "./mod.ts";

export type MatrixLike<DT extends DataType> = {
  /** Raw 1D TypedArray supplied */
  data: DType<DT>;
  /** Number of rows, columns */
  shape: [number, number];
};

/**
 * Class for 2D Arrays.
 * This is not akin to a mathematical Matrix (a collection of column vectors).
 * This is a collection of row vectors.
 */
export class Matrix<DT extends DataType> implements Sliceable, MatrixLike<DT> {
  /** Type of data in the matrix */
  dType: DT;
  /** Number of rows in the matrix */
  nRows: number;
  /** Number of columns in the matrix */
  nCols: number;
  /** Raw 1D TypedArray supplied */
  data: DType<DT>;
  /**
   * Create a matrix from a typed array
   * @param data Data to move into the matrix.
   * @param shape [rows, columns] of the matrix.
   */
  constructor(matrix: MatrixLike<DT>, config?: undefined);
  constructor(array: DTypeValue<DT>[][], config: { dType: DT });
  constructor(data: DType<DT>, config: { shape: [number, number] });
  constructor(dType: DT, config: { shape: [number, number] });
  constructor(
    data: MatrixLike<DT> | DTypeValue<DT>[][] | DType<DT> | DT,
    config: { shape?: [number, number]; dType?: DT } | undefined = {}
  ) {
    this.nRows = this.nCols = 0;
    // Check if it is an actual array
    if (ArrayBuffer.isView(data)) {
      const { shape } = config;
      if(!shape) throw new Error("Cannot initialize with incomplete shape (n-rows, n-cols)");
      this.data = data;
      this.dType = getDataType(data);
      this.nRows = shape[0];
      this.nCols =
        typeof shape[1] === "number" ? shape[1] : this.data.length / shape[0];
    } else if (typeof data === "string") {
      // if not, construct a new one
      const { shape } = config;
      if(!shape) throw new Error("Cannot initialize with incomplete shape (n-rows, n-cols)");
      if (typeof shape[1] !== "number") {
        throw new Error("Cannot initialize with incomplete shape (n-cols)");
      }
      this.nRows = shape[0];
      this.nCols = shape[1];
      this.data = new (getConstructor(data))(shape[0] * shape[1]) as DType<DT>;
      this.dType = data;
    } else if (Array.isArray(data)) {
      const { dType } = config;
      if(!dType) throw new Error("Cannot initialize without dType.");
      this.nRows = data.length;
      this.nCols = data[0].length;
      // @ts-ignore a
      this.data = getConstructor(dType).from(data.flat(2));
      this.dType = dType;
    } else if (data.data && data.shape) {
      this.data = data.data;
      this.nRows = data.shape[0];
      this.nCols =
        typeof data.shape[1] === "number"
          ? data.shape[1]
          : this.data.length / data.shape[0];
      this.dType = getDataType(data.data);
    } else {
      throw new Error("No overload matches your call for `new Matrix()`.");
    }
  }
  /** Convert the Matrix into a HTML table */
  get html(): string {
    let res = "<table>\n";
    res += "<thead><tr><DTh>idx</th>";
    for (let i = 0; i < this.nCols; i += 1) {
      res += `<DTh>${i}</th>`;
    }
    res += "</tr></thead>";
    let j = 0;
    for (const row of this.rows()) {
      res += `<tr><td><strong>${j}</strong></td>`;
      j += 1;
      for (const x of row) {
        res += `<td>${x}</td>`;
      }
      res += "</tr>";
    }
    res += "</table>";
    return res;
  }
  get length(): number {
    return this.nRows;
  }
  /** Returns [rows, columns] */
  get shape(): [number, number] {
    return [this.nRows, this.nCols];
  }
  /** Get the transpose of the matrix. This method clones the matrix. */
  get T(): Matrix<DT> {
    const resArr = new (this.data.constructor as DTypeConstructor<DT>)(
      this.nRows * this.nCols
    ) as DType<DT>;
    let i = 0;
    for (const col of this.cols()) {
      // @ts-ignore This line will work
      resArr.set(col, i * this.nRows);
      i += 1;
    }
    return new Matrix(resArr, { shape: [this.nCols, this.nRows] });
  }
  /** Get a pretty version for printing. DO NOT USE FOR MATRICES WITH MANY COLUMNS. */
  get pretty(): string {
    let res = "";
    for (const row of this.rows()) {
      res += row.join("\t");
      res += "\n";
    }
    return res;
  }
  /** Alias for row */
  at(pos: number): DType<DT> {
    return this.row(pos);
  }
  /** Get the nth column in the matrix */
  col(n: number): DType<DT> {
    let i = 0;
    const col = new (this.data.constructor as DTypeConstructor<DT>)(
      this.nRows
    ) as DType<DT>;
    let offset = 0;
    while (i < this.nRows) {
      col[i] = this.data[offset + n];
      i += 1;
      offset += this.nCols;
    }
    return col;
  }
  colMean(): DType<DT> {
    const sum = this.colSum();
    let i = 0;
    const divisor = (
      typeof this.data[0] === "bigint" ? BigInt(this.nCols) : this.nCols
    ) as DTypeValue<DT>;
    while (i < sum.length) {
      sum[i] = (sum[i] as DTypeValue<DT>) / divisor;
      i += 1;
    }
    return sum;
  }
  /** Get a column array of all column sums in the matrix */
  colSum(): DType<DT> {
    const sum = new (this.data.constructor as DTypeConstructor<DT>)(
      this.nRows
    ) as DType<DT>;
    let i = 0;
    while (i < this.nCols) {
      let j = 0;
      while (j < this.nRows) {
        // @ts-ignore I'll fix this later
        sum[j] = (sum[j] + this.item(j, i)) as AddDTypeValues<
          DTypeValue<DT>,
          DTypeValue<DT>
        >;
        j += 1;
      }
      i += 1;
    }
    return sum;
  }
  /** Get the dot product of two matrices */
  dot(rhs: Matrix<DT>): number | bigint {
    if (rhs.nRows !== this.nRows) {
      throw new Error("Matrices must have equal rows.");
    }
    if (rhs.nCols !== this.nCols) {
      throw new Error("Matrices must have equal cols.");
    }
    let res = (typeof this.data[0] === "bigint" ? 0n : 0) as DTypeValue<DT>;
    let j = 0;
    while (j < this.nCols) {
      let i = 0;
      while (i < this.nRows) {
        const adder =
          (this.item(i, j) as DTypeValue<DT>) *
          (rhs.item(i, j) as DTypeValue<DT>);
        // @ts-ignore I'll fix this later
        res += adder as DTypeValue<DT>;
        i += 1;
      }
      j += 1;
    }
    return res;
  }
  /** Filter the matrix by rows */
  filter(
    fn: (value: DType<DT>, row: number, _: DType<DT>[]) => boolean
  ): Matrix<DT> {
    const satisfying: number[] = [];
    let i = 0;
    while (i < this.nRows) {
      if (fn(this.row(i), i, [])) {
        satisfying.push(i);
      }
      i += 1;
    }
    const matrix = new Matrix(this.dType, {
      shape: [satisfying.length, this.nCols],
    });
    i = 0;
    while (i < satisfying.length) {
      // @ts-ignore This line will work
      matrix.setRow(i, this.row(satisfying[i]));
      i += 1;
    }
    return matrix;
  }
  /** Get an item using a row and column index */
  item(row: number, col: number): DTypeValue<DT> {
    return this.data[row * this.nCols + col] as DTypeValue<DT>;
  }
  /** Get the nth row in the matrix */
  row(n: number): DType<DT> {
    return this.data.slice(n * this.nCols, (n + 1) * this.nCols) as DType<DT>;
  }
  rowMean(): DType<DT> {
    const sum = this.rowSum();
    let i = 0;
    const divisor = (
      typeof this.data[0] === "bigint" ? BigInt(this.nRows) : this.nRows
    ) as DTypeValue<DT>;
    while (i < sum.length) {
      sum[i] = (sum[i] as DTypeValue<DT>) / divisor;
      i += 1;
    }
    return sum;
  }
  /** Compute the sum of all rows */
  rowSum(): DType<DT> {
    const sum = new (this.data.constructor as DTypeConstructor<DT>)(
      this.nCols
    ) as DType<DT>;
    let i = 0;
    let offset = 0;
    while (i < this.nRows) {
      let j = 0;
      while (j < this.nCols) {
        // @ts-ignore This line will work
        sum[j] += this.data[offset + j];
        j += 1;
      }
      i += 1;
      offset += this.nCols;
    }
    return sum;
  }
  /**
   * Add a value to an existing element
   * Will throw an error if the types mismatch
   */
  setAdd(row: number, col: number, val: number | bigint) {
    // @ts-expect-error Must provide appropriate number/bigint argument
    this.data[row * this.nCols + col] += val;
  }
  /** Replace a column */
  setCol(col: number, val: ArrayLike<number>): number {
    let i = 0;
    while (i < this.nRows) {
      this.data[i * this.nCols + col] = val[i];
      i += 1;
    }
    return col;
  }
  /** Set a value in the matrix */
  setCell(row: number, col: number, val: number) {
    this.data[row * this.nCols + col] = val;
  }
  /** Replace a row */
  setRow(row: number, val: ArrayLike<number> | ArrayLike<bigint>) {
    // @ts-expect-error Must provide appropriate number/bigint argument
    this.data.set(val, row * this.nCols);
  }
  /** Slice matrix by rows */
  slice(start = 0, end?: number): Matrix<DT> {
    return new Matrix<DT>(
      this.data.slice(
        start ? start * this.nCols : 0,
        end ? end * this.nCols : undefined
      ) as DType<DT>,
      { shape: [end ? end - start : this.nRows - start, this.nCols] }
    );
  }
  /** Iterate through rows */
  *rows(): Generator<DType<DT>> {
    let i = 0;
    while (i < this.nRows) {
      yield this.data.slice(i * this.nCols, (i + 1) * this.nCols) as DType<DT>;
      i += 1;
    }
  }
  /** Iterate through columns */
  *cols(): Generator<DType<DT>> {
    let i = 0;
    while (i < this.nCols) {
      let j = 0;
      const col = new (this.data.constructor as DTypeConstructor<DT>)(
        this.nRows
      ) as DType<DT>;
      while (j < this.nRows) {
        col[j] = this.data[j * this.nCols + i];
        j += 1;
      }
      yield col;
      i += 1;
    }
  }

  [Symbol.for("Jupyter.display")](): Record<string, string> {
    return {
      // Plain text content
      "text/plain": this.pretty,

      // HTML output
      "text/html": this.html,
    };
  }
}
