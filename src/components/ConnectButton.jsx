import { useState } from 'react';
import { initWeb3 } from '../web3/service';

export default function ConnectButton({ onConnect, account, onDisconnect }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (account) {
      onDisconnect();
      return;
    }

    setLoading(true);
    try {
      const { vault, address } = await initWeb3();
      const masterAddress = await vault.masterAddress();
      const isAuthorized = await vault.isAuthorized(address);
      onConnect({ address, vault, masterAddress, isAuthorized });
    } catch (err) {
      alert('Connection failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        padding: '8px 16px',
        backgroundColor: '#333',
        color: 'white',
        border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}
    >
      {account ? (
        <>
          {account.slice(0, 6)}...{account.slice(-4)}
          <span style={{ fontSize: '12px', color: '#aaa' }}>(click to disconnect)</span>
        </>
      ) : (
        'Подключить MetaMask'
      )}
    </button>
  );
}