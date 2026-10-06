import { UseCaseError } from '@/core/errors/use-case-error'
import { AssetType } from '@/domain/shared/enums/asset-type'

export class UnsupportedAssetTypeError extends Error implements UseCaseError {
  constructor(assetTypes: AssetType[]) {
    super(
      `The comparator only supports fixed income. Unsupported: ${assetTypes.join(', ')}.`
    )
  }
}
