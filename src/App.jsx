import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import ConnectButton from './components/ConnectButton';
import BackupForm from './components/BackupForm';
import AuthPanel from './components/AuthPanel';
import RecordsPanel from './components/RecordsPanel';
import TestRunner from './components/TestRunner'; 
import SecurityTests from './components/SecurityTests'; 
import { getEncryptionKey } from './crypto/encrypt';
import { BrowserProvider } from 'ethers';

function Dashboard() {
  const [account, setAccount] = useState(null);
  const [vault, setVault] = useState(null);
  const [role, setRole] = useState(null);
  const [masterAddress, setMasterAddress] = useState('');
  const [backups, setBackups] = useState([]);
  const [encryptionKey, setEncryptionKey] = useState(null);

  const handleConnect = async ({ address, vault, masterAddress, isAuthorized }) => {
    setAccount(address);
    setVault(vault);
    setMasterAddress(masterAddress);

    if (address.toLowerCase() === masterAddress.toLowerCase()) {
      setRole('master');
    } 
    else if (isAuthorized) {
      try {
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const key = await getEncryptionKey(provider, address);
        setEncryptionKey(key);
        setRole('authorized');
        await loadBackups(vault, address);
      } 
      catch (err) {
        if (err.code === 'ACTION_REJECTED') {
          alert('Вы отменили запрос подписи. Подключение прервано.');
          handleDisconnect();
          return;
        }
        console.error('Failed to get encryption key:', err);
        alert('Ошибка при получении ключа шифрования: ' + err.message);
        handleDisconnect();
        return;
      }
    } 
    else {
      setRole('unauthorized');
    }
  };

  const loadBackups = async (vault, address) => {
    try {
      const keys = await vault.getAllKeys();
      const records = [];
      for (const key of keys) {
        const [createdAt, updatedAt, allowedOverwrite, deprecated, cid, description] = await vault.getBackup(key);
        records.push({ key, createdAt, updatedAt, allowedOverwrite, deprecated, cid, description });
      }
      setBackups(records);
    } catch (err) {
      console.error('Failed to load backups:', err);
    }
  };

  const handleCreate = (backup) => {
    setBackups(prev => [...prev, backup]);
  };

  const handleDeprecated = (key) => {
    setBackups(prev => prev.filter(b => b.key !== key));
  };

  const handleDisconnect = async () => {
    if (window.ethereum) {
      try {
        await window.ethereum.request({
          method: 'wallet_revokePermissions',
          params: [{ eth_accounts: {} }]
        });
      } catch (err) {
        console.warn('Failed to revoke permissions:', err);
      }
    }
    setAccount(null);
    setVault(null);
    setRole(null);
    setMasterAddress('');
    setBackups([]);
    setEncryptionKey(null);
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#1e1e1e',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      padding: '20px',
      boxSizing: 'border-box',
      overflowY: 'auto'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '10px',
        borderBottom: '1px solid #444'
      }}>
        <div>
          <strong>Мастер-адрес:</strong> {masterAddress || '0x...'}
        </div>
        <ConnectButton 
          onConnect={handleConnect} 
          account={account} 
          onDisconnect={handleDisconnect} 
        />
      </div>

      <div style={{
        display: 'flex',
        gap: '20px',
        flexGrow: 1,
        overflowY: 'auto'
      }}>
        <div style={{
          flex: '0 0 300px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          overflowY: 'auto'
        }}>
          <div style={{
            border: '1px solid #444',
            padding: '15px',
            borderRadius: '4px',
            backgroundColor: '#2d2d2d'
          }}>
            <h4>Добавить запись</h4>
            {role === 'authorized' && vault ? (
              <BackupForm vault={vault} onCreated={handleCreate} />
            ) : (
              <p style={{ color: '#888' }}>Только для авторизованных пользователей</p>
            )}
          </div>

          <div style={{
            border: '1px solid #444',
            padding: '15px',
            borderRadius: '4px',
            backgroundColor: '#2d2d2d'
          }}>
            <h4>Авторизовать</h4>
            {role === 'master' && vault ? (
              <AuthPanel vault={vault} action="authorize" />
            ) : (
              <p style={{ color: '#888' }}>Только для мастера</p>
            )}
          </div>

          <div style={{
            border: '1px solid #444',
            padding: '15px',
            borderRadius: '4px',
            backgroundColor: '#2d2d2d'
          }}>
            <h4>Деавторизовать</h4>
            {role === 'master' && vault ? (
              <AuthPanel vault={vault} action="deauthorize" />
            ) : (
              <p style={{ color: '#888' }}>Только для мастера</p>
            )}
          </div>
        </div>

        <div style={{
          flex: 1,
          border: '1px solid #444',
          padding: '15px',
          borderRadius: '4px',
          backgroundColor: '#2d2d2d',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <h4>Записи</h4>
          {role === 'authorized' ? (
            <RecordsPanel 
              backups={backups} 
              vault={vault} 
              account={account} 
              role={role} 
              encryptionKey={encryptionKey} 
              onDeprecated={handleDeprecated} 
              setBackups={setBackups}
            />
          ) : (
            <p style={{ color: '#888' }}>Только для авторизованных пользователей</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/test" element={<TestRunner />} />
      <Route path="/security" element={<SecurityTests />} />
    </Routes>
  );
}