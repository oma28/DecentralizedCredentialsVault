import { useState } from 'react';

export default function AuthPanel({ vault, action }) {
  const [addr, setAddr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let tx;
      if (action === 'authorize') {
        tx = await vault.authorize(addr);
      } else {
        tx = await vault.deauthorize(addr);
      }

      await tx.wait();

      alert(action === 'authorize' ? 'Пользователь авторизован' : 'Пользователь деавторизован');
      setAddr('');
    } catch (err) {
      if (err.code === 'ACTION_REJECTED') {
        console.log('Транзакция отменена пользователем');
        return;
      }
      alert('Ошибка: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ marginBottom: '8px' }}>
        <label>Адрес: </label>
        <input
          type="text"
          value={addr}
          onChange={(e) => setAddr(e.target.value)}
          placeholder="0x..."
          style={{
            width: '100%',
            padding: '4px',
            boxSizing: 'border-box'
          }}
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: '6px',
          backgroundColor: action === 'authorize' ? '#4CAF50' : '#f44336',
          color: 'white',
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          boxSizing: 'border-box'
        }}
      >
        {loading ? '...' : 'Отправить'}
      </button>
    </form>
  );
}