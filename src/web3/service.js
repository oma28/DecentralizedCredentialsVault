import { BrowserProvider, Contract } from 'ethers';
import VaultABI from '../contracts/Vault.json';

const VAULT_ADDRESS = import.meta.env.VITE_VAULT_CONTRACT;

export const initWeb3 = async () => {
  if (!window.ethereum) throw new Error('MetaMask not installed');
  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts'
  });

  if (accounts.length === 0) {
    await window.ethereum.request({
      method: 'eth_requestAccounts'
    });
  }

  const provider = new BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  const network = await provider.getNetwork();
  if (network.chainId !== 11155111) {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0xaa36a7' }]
    });
  }

  const vault = new Contract(VAULT_ADDRESS, VaultABI, signer);
  return { provider, vault, address };
};