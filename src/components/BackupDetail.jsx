import { useState, useEffect } from 'react';
import { decryptBackup } from '../crypto/encrypt.js';
import { getFromIPFS } from '../web3/upload.js';

export default function BackupDetail({ backup, vault, encryptionKey, onClose, onUpdated, onDeprecated }) {
  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const [secret, setSecret] = useState('');
  const [description, setDescription] = useState(backup.description);
  const [loadingUpdate, setLoadingUpdate] = useState(false); 
  const [loadingDeprecate, setLoadingDeprecate] = useState(false); 

  useEffect(() => {
    loadBackup();
  }, [backup.cid]);

  const loadBackup = async () => {
    try {
      const data = await getFromIPFS(backup.cid);
      const plaintext = await decryptBackup(data.ciphertext, data.iv, encryptionKey);
      setSecret(plaintext);
    } catch (err) {
      alert('Failed to decrypt backup: ' + err.message);
    }
  };

  const handleUpdate = async () => {
    if (!backup.allowedOverwrite) return;

    setLoadingUpdate(true);
    try {
      const tx = await vault.updateBackup(backup.key, backup.cid, description);
      await tx.wait();
      onUpdated({ ...backup, description });
      alert('Запись успешно обновлена!');
    } catch (err) {
      if (err.code === 'ACTION_REJECTED') {
        console.log('Транзакция отменена');
        return;
      }
      alert('Ошибка при обновлении: ' + err.message);
    } finally {
      setLoadingUpdate(false);
    }
  };

  const handleDeprecate = async () => {
    if (window.confirm('Эту операцию нельзя отменить. Вы уверены?')) {
      setLoadingDeprecate(true);
      try {
        const tx = await vault.deprecateBackup(backup.key);
        await tx.wait();
        onDeprecated(backup.key);
        alert('Запись помечена как устаревшая.');
      } catch (err) {
        if (err.code === 'ACTION_REJECTED') {
          console.log('Транзакция отменена');
          return;
        }
        alert('Ошибка при пометке как устаревшая: ' + err.message);
      } finally {
        setLoadingDeprecate(false);
      }
    }
  };

  const ipfsUrl = `https://ipfs.io/ipfs/${backup.cid}`;

  const isDeprecated = backup.deprecated;

  return (
    <div style={{
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.8)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#2d2d2d',
        padding: '20px',
        borderRadius: '8px',
        width: '400px',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#fff'
          }}
        >
          ×
        </button>

        <h4 style={{ marginBottom: '10px' }}>
          {isDeprecated ? <span style={{ color: 'red' }}>Ключ: {backup.key} (устарело)</span> : `Ключ: ${backup.key}`}
        </h4>

        <div style={{ marginBottom: '10px' }}>
          <label>IPFS URL:</label>
          <div style={{ wordBreak: 'break-all', color: '#aaa' }}>
            <a href={ipfsUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#66b3ff' }}>
              {ipfsUrl}
            </a>
          </div>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Секрет:</label>
          <div style={{ display: 'flex', gap: '5px' }}>
            <input
              type={isSecretVisible ? 'text' : 'password'}
              value={secret}
              readOnly
              style={{ width: '100%', padding: '4px' }}
            />
            <button
              onClick={() => setIsSecretVisible(prev => !prev)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#444',
                color: 'white',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              {isSecretVisible ? 'Скрыть' : 'Показать'}
            </button>
          </div>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Описание:</label>
          <textarea
            value={description}
            maxLength={100}
            onChange={(e) => setDescription(e.target.value)}
            rows="4"
            style={{
              width: '100%',
              padding: '4px',
              resize: 'vertical',
              boxSizing: 'border-box',
              fontSize: '14px'
            }}
            disabled={isDeprecated}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
          <button
            onClick={handleUpdate}
            disabled={isDeprecated || !backup.allowedOverwrite || loadingUpdate}
            style={{
              padding: '8px',
              backgroundColor: isDeprecated || !backup.allowedOverwrite ? '#666' : '#2196F3',
              color: 'white',
              border: 'none',
              cursor: isDeprecated || !backup.allowedOverwrite || loadingUpdate ? 'not-allowed' : 'pointer'
            }}
          >
            {isDeprecated ? 'Устарело' : !backup.allowedOverwrite ? 'Редактирование запрещено' : loadingUpdate ? 'Обновляю...' : 'Изменить'}
          </button>

          <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid #444' }} />

          <button
            onClick={handleDeprecate}
            disabled={isDeprecated || loadingDeprecate}
            style={{
              padding: '8px',
              backgroundColor: isDeprecated ? '#666' : '#f44336',
              color: 'white',
              border: 'none',
              cursor: isDeprecated || loadingDeprecate ? 'not-allowed' : 'pointer'
            }}
          >
            {isDeprecated ? 'Устарело' : loadingDeprecate ? 'Помечаю...' : 'Сделать устаревшим'}
          </button>
        </div>
      </div>
    </div>
  );
}