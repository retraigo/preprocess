import { DataType } from "../../../utils/common_types.ts";
import { Matrix, MatrixLike } from "../../../mod.ts";
import { multiplyDiags } from "../../../utils/math.ts";

/** Convert tf features (CountVectorizer) into tf-idf features. */
export class TfIdfTransformer {
  idf: null | Float64Array;
  constructor({ idf }: { idf?: Float64Array } = {}) {
    this.idf = idf ?? null;
  }
  /**
   * Get idf matrix from tf features.
   * @param data tf features from CountVectorizer
   * @returns Tf-Idf transformer
   */
  fit<T extends DataType>(data: Matrix<T>): TfIdfTransformer {
    const shape = {
      features: data.nCols,
      samples: data.nRows,
    };
    const freq = data.rowSum();

    const idf = new Float64Array(freq.length);

    let i = 0;
    while (i < idf.length) {
      idf[i] = Math.log(shape.samples / Number(freq[i])) + 1;
      i += 1;
    }
    this.idf = idf;
    return this;
  }
  /**
   * Transform an tf features into tf-idf features.
   * @param data tf features from CountVectorizer
   * @returns Sparse matrix of Tf-Idf features
   */
  transform<T extends DataType>(data: MatrixLike<T>): Matrix<T> {
    if (this.idf === null) throw new Error("IDF not initialized yet.");
    return multiplyDiags(data, this.idf);
  }
}