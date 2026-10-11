import { describe, expect, it } from 'vitest'
import { AssetType } from '@/domain/shared/enums/asset-type'
import { Indexer } from '@/domain/shared/enums/indexer'
import { AssetClass } from '../entities/enums/asset-class'
import { AssetClassifier } from './asset-classifier'

describe('Asset Classifier', () => {
  it.each([
    [AssetType.CDB, Indexer.CDI, AssetClass.FIXED_POST],
    [AssetType.LCI, Indexer.CDI, AssetClass.FIXED_POST],
    [AssetType.TESOURO, Indexer.SELIC, AssetClass.FIXED_POST],
    [AssetType.TESOURO, Indexer.IPCA, AssetClass.FIXED_INFLATION],
    [AssetType.DEBENTURE, Indexer.IPCA, AssetClass.FIXED_INFLATION],
    [AssetType.CRI, Indexer.IPCA, AssetClass.FIXED_INFLATION],
    [AssetType.CDB, Indexer.PRE, AssetClass.FIXED_PRE],
    [AssetType.TESOURO, Indexer.PRE, AssetClass.FIXED_PRE],
  ])(
    'should classify %s indexed to %s as %s',
    (assetType, indexer, expected) => {
      expect(AssetClassifier.classify({ assetType, indexer })).toBe(expected)
    }
  )

  it('should classify fixed income without an indexer as OTHER', () => {
    expect(
      AssetClassifier.classify({ assetType: AssetType.CDB, indexer: null })
    ).toBe(AssetClass.OTHER)
  })

  it.each([
    [AssetType.ACAO, AssetClass.STOCKS],
    [AssetType.FII, AssetClass.REAL_ESTATE_FUNDS],
    [AssetType.FUNDO, AssetClass.FUNDS],
    [AssetType.CRIPTO, AssetClass.CRYPTO],
    [AssetType.OUTRO, AssetClass.OTHER],
  ])(
    'should classify %s as %s regardless of the indexer',
    (assetType, expected) => {
      expect(AssetClassifier.classify({ assetType, indexer: null })).toBe(
        expected
      )
      expect(
        AssetClassifier.classify({ assetType, indexer: Indexer.CDI })
      ).toBe(expected)
    }
  )
})
