import { useState } from 'react';
import { BrowserProvider } from 'ethers';
import { getEncryptionKey, encryptBackup } from '../crypto/encrypt.js';
import { uploadToIPFS } from '../web3/upload.js';

export default function BackupForm({ vault, onCreated }) {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [allowOverwrite, setAllowOverwrite] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!key || !value) {
      alert('Ключ и значение обязательны');
      return;
    }

    setLoading(true);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      const encryptionKey = await getEncryptionKey(provider, address);
      const encrypted = await encryptBackup(value, encryptionKey);
      const cid = await uploadToIPFS(encrypted);

      const tx = await vault.createBackup(key, cid, description, allowOverwrite);
      await tx.wait();

      const [createdAt, updatedAt, allowedOverwrite, deprecated, cidFromContract, descFromContract] = 
        await vault.getBackup(key);

      onCreated({
        key,
        createdAt: Number(createdAt),
        updatedAt: Number(updatedAt),
        allowedOverwrite,
        deprecated,
        cid: cidFromContract,
        description: descFromContract
      });

      alert(`Запись "${key}" успешно создана и сохранена в блокчейне!`);
      
      setKey('');
      setValue('');
      setDescription('');
      setAllowOverwrite(false);
    } catch (err) {
      if (err.code === 'ACTION_REJECTED') {
        console.log('Транзакция отменена пользователем');
        return;
      }

      let errorMessage = 'Ошибка при создании записи';

      if (err.reason) {
        errorMessage = err.reason;
      } else if (err.data && err.data.reason) {
        errorMessage = err.data.reason;
      } else if (err.message.includes('revert')) {
        errorMessage = 'Произошла ошибка в контракте';
      }

      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ marginBottom: '8px' }}>
        <label>Ключ: </label>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="my-key"
          style={{
            width: '100%',
            padding: '4px',
            boxSizing: 'border-box'
          }}
          required
        />
      </div>

      <div style={{ marginBottom: '8px' }}>
        <label>Значение: </label>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="secret value"
          style={{
            width: '100%',
            padding: '4px',
            boxSizing: 'border-box'
          }}
          required
        />
      </div>

      <div style={{ marginBottom: '8px' }}>
        <label>Описание: </label>
        <input
          type="text"
          maxLength={100}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="описание (необязательно)"
          style={{
            width: '100%',
            padding: '4px',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
        <input
          type="checkbox"
          id="allowOverwrite"
          checked={allowOverwrite}
          onChange={(e) => setAllowOverwrite(e.target.checked)}
        />
        <label htmlFor="allowOverwrite" style={{ margin: 0 }}>
          Разрешить редактирование
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '8px',
          backgroundColor: '#2196F3',
          color: 'white',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          boxSizing: 'border-box'
        }}
      >
        {loading ? 'Создаю...' : 'Создать'}
      </button>
    </form>
  );
}