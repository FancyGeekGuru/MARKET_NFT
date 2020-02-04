import { takeEvery, call, put, select } from 'redux-saga/effects'
import { push } from 'connected-react-router'
import { Eth } from 'web3x-es/eth'
import { Address } from 'web3x-es/address'
import {
  DEFAULT_FETCH_NFTS_OPTIONS,
  FETCH_NFTS_REQUEST,
  FetchNFTsRequestAction,
  fetchNFTsSuccess,
  fetchNFTsFailure,
  FETCH_NFT_REQUEST,
  FetchNFTRequestAction,
  fetchNFTSuccess,
  fetchNFTFailure,
  TRANSFER_NFT_REQUEST,
  TransferNFTRequestAction,
  transferNFTSuccess,
  transferNFTFailure
} from './actions'
import { nftAPI } from '../../lib/api/nft'
import { getAddress } from '../wallet/selectors'
import { locations } from '../routing/locations'
import { ERC721 } from '../../contracts/ERC721'

export function* nftSaga() {
  yield takeEvery(FETCH_NFTS_REQUEST, handleFetchNFTsRequest)
  yield takeEvery(FETCH_NFT_REQUEST, handleFetchNFTRequest)
  yield takeEvery(TRANSFER_NFT_REQUEST, handleTransferNFTRequest)
}

function* handleFetchNFTsRequest(action: FetchNFTsRequestAction) {
  const options = {
    ...DEFAULT_FETCH_NFTS_OPTIONS,
    ...action.payload.options,
    variables: {
      ...DEFAULT_FETCH_NFTS_OPTIONS.variables,
      ...action.payload.options.variables
    }
  }

  try {
    const [nfts, accounts, orders] = yield call(() => nftAPI.fetch(options))
    yield put(fetchNFTsSuccess(options, nfts, accounts, orders))
  } catch (error) {
    yield put(fetchNFTsFailure(options, error.message))
  }
}

function* handleFetchNFTRequest(action: FetchNFTRequestAction) {
  const { contractAddress, tokenId } = action.payload

  try {
    const [nft, order] = yield call(() =>
      nftAPI.fetchOne(contractAddress, tokenId)
    )
    yield put(fetchNFTSuccess(nft, order))
  } catch (error) {
    yield put(fetchNFTFailure(contractAddress, tokenId, error.message))
  }
}

function* handleTransferNFTRequest(action: TransferNFTRequestAction) {
  const { nft, address } = action.payload
  try {
    const eth = Eth.fromCurrentProvider()
    if (!eth) throw new Error('Could not connect to Ethereum')
    const erc721 = new ERC721(eth, Address.fromString(nft.contractAddress))
    const from = yield select(getAddress)
    if (!from) throw new Error('Invalid address. Wallet must be connected.')
    const txHash = yield call(() =>
      erc721.methods
        .transferFrom(
          Address.fromString(from),
          Address.fromString(address),
          nft.tokenId
        )
        .send({ from: Address.fromString(from) })
        .getTxHash()
    )
    yield put(transferNFTSuccess(nft, address, txHash))
    yield put(push(locations.activity()))
  } catch (error) {
    yield put(transferNFTFailure(nft, address, error.message))
  }
}
