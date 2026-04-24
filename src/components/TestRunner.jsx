import { useState } from 'react';
import { ethers } from 'ethers';
import { initWeb3 } from '../web3/service';
import { encryptBackup, decryptBackup } from '../crypto/encrypt';
import { uploadToIPFS, getFromIPFS } from '../web3/upload';
import VaultABI from '../contracts/Vault.json';

const TEST_CONFIG = {
  lengths: [16, 32, 64, 128, 256],
  countPerLength: 10,
  descriptionPrefix: "VKR Test"
};

export default function TestRunner() {
  const [logs, setLogs] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [csvUrl, setCsvUrl] = useState(null);

  const addLog = (msg) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const generateSecret = (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleStartTests = async () => {
    if (isRunning) return;
    
    setLogs([]);
    setResults(null);
    setCsvUrl(null);
    setIsRunning(true);
    setProgress(5);

    try {
      addLog('🔌 Подключение кошелька...');
      const { vault, address, provider } = await initWeb3();
      
      addLog(`✅ Подключено: ${address.slice(0, 6)}...${address.slice(-4)}`);
      
      addLog('🔍 Проверка прав...');
      const masterAddress = await vault.masterAddress();
      const isAuthorized = await vault.isAuthorized(address);

      if (address.toLowerCase() === masterAddress.toLowerCase()) {
        throw new Error('ВЫ ВОШЛИ КАК MASTER.\nМастеру запрещено создавать бэкапы.\nПереключитесь на авторизованный аккаунт.');
      } 
      else if (!isAuthorized) {
        throw new Error('НЕТ ПРАВ ДОСТУПА.\nАдрес не авторизован.');
      } 
      else {
        addLog('✅ Доступ разрешен. Запуск тестов...');
      }

      setProgress(10);
      await runActualTests(vault, address, provider);

    } catch (err) {
      console.error(err);
      addLog(`❌ СТОП: ${err.message}`);
      setIsRunning(false);
      setProgress(0);
    }
  };

  const runActualTests = async (vault, address, provider) => {
    const totalIterations = TEST_CONFIG.lengths.length * TEST_CONFIG.countPerLength;
    let completedCount = 0;
    const resultsData = [];
    
    // Счетчики времени и газа
    const totals = {
      encryptTime: 0,
      uploadTime: 0,
      signTime: 0,
      confirmTime: 0,
      downloadTime: 0,
      decryptTime: 0,
      gasUsed: 0
    };

    try {
      for (const len of TEST_CONFIG.lengths) {
        addLog(`--- Группа: длина ${len} симв. ---`);

        for (let i = 0; i < TEST_CONFIG.countPerLength; i++) {
          const iterationId = completedCount + 1;
          
          // Генерация случайного ключа
          const randomSuffix = Math.random().toString(36).substring(2, 8);
          const keyName = `key_${randomSuffix}_${iterationId}`;
          const secretData = generateSecret(len);

          // 1. Шифрование
          let tStart = performance.now();
          const message = `VaultBackup:${address.toLowerCase()}`;
          const signer = await provider.getSigner();
          const signature = await signer.signMessage(message);
          const hash = ethers.keccak256(ethers.toUtf8Bytes(signature));
          const keyBytes = ethers.getBytes(hash);
          const encrypted = await encryptBackup(secretData, keyBytes);
          let tEnd = performance.now();
          const timeEncrypt = tEnd - tStart;
          totals.encryptTime += timeEncrypt;
          
          // 2. Загрузка в IPFS
          tStart = performance.now();
          const cid = await uploadToIPFS(encrypted);
          tEnd = performance.now();
          const timeUpload = tEnd - tStart;
          totals.uploadTime += timeUpload;

          // 3. Подпись и отправка транзакции
          tStart = performance.now();
          const tx = await vault.createBackup(keyName, cid, `${TEST_CONFIG.descriptionPrefix} ${len}b`, false);
          tEnd = performance.now();
          const timeSign = tEnd - tStart;
          totals.signTime += timeSign;

          // 4. Подтверждение транзакции (ожидание блока)
          tStart = performance.now();
          const receipt = await tx.wait();
          tEnd = performance.now();
          const timeConfirm = tEnd - tStart;
          totals.confirmTime += timeConfirm;
          
          totals.gasUsed += Number(receipt.gasUsed);

          // 5. Загрузка из IPFS
          tStart = performance.now();
          const downloadedData = await getFromIPFS(cid);
          tEnd = performance.now();
          const timeDownload = tEnd - tStart;
          totals.downloadTime += timeDownload;

          // 6. Расшифровка
          tStart = performance.now();
          const decrypted = await decryptBackup(downloadedData.ciphertext, downloadedData.iv, keyBytes);
          tEnd = performance.now();
          const timeDecrypt = tEnd - tStart;
          totals.decryptTime += timeDecrypt;

          // Проверка целостности
          if (decrypted !== secretData) {
            addLog(`❌ ОШИБКА ЦЕЛОСТНОСТИ: ${keyName}`);
          } else {
            // Логируем только каждую 10-ю операцию, чтобы не засорять экран
            if (iterationId % 10 === 0 || iterationId === totalIterations) {
              addLog(`[${iterationId}/${totalIterations}] OK. Газ: ${receipt.gasUsed}`);
            }
          }

          resultsData.push({
            iteration: iterationId,
            backupKey: keyName,
            dataLength: len,
            gasUsed: Number(receipt.gasUsed),
            timeEncrypt: timeEncrypt.toFixed(2),
            timeUpload: timeUpload.toFixed(2),
            timeSign: timeSign.toFixed(2),
            timeConfirm: timeConfirm.toFixed(2),
            timeDownload: timeDownload.toFixed(2),
            timeDecrypt: timeDecrypt.toFixed(2)
          });

          completedCount++;
          setProgress(10 + ((completedCount / totalIterations) * 90));
          
          // Небольшая пауза
          await new Promise(r => setTimeout(r, 500)); 
        }
      }

      // === РАСЧЕТ СРЕДНИХ ЗНАЧЕНИЙ ===
      const avgEncrypt = totals.encryptTime / totalIterations;
      const avgUpload = totals.uploadTime / totalIterations;
      const avgSign = totals.signTime / totalIterations;
      const avgConfirm = totals.confirmTime / totalIterations;
      const avgTotalCreate = avgEncrypt + avgUpload + avgSign + avgConfirm;
      
      const avgDownload = totals.downloadTime / totalIterations;
      const avgDecrypt = totals.decryptTime / totalIterations;
      const avgTotalRestore = avgDownload + avgDecrypt;
      
      const avgGas = totals.gasUsed / totalIterations;

      // === ВЫВОД ТАБЛИЦЫ В ЛОГИ ===
      const tableData = [
        { op: "Шифрование (AES-GCM)", time: avgEncrypt.toFixed(2) },
        { op: "Загрузка в IPFS", time: avgUpload.toFixed(2) },
        { op: "Подпись транзакции", time: avgSign.toFixed(2) },
        { op: "Подтверждение транзакции", time: avgConfirm.toFixed(2) },
        { op: "ИТОГО создание бэкапа", time: avgTotalCreate.toFixed(2) },
        { op: "Загрузка из IPFS", time: avgDownload.toFixed(2) },
        { op: "Расшифровка", time: avgDecrypt.toFixed(2) },
        { op: "ИТОГО восстановление", time: avgTotalRestore.toFixed(2) }
      ];

      addLog('\n📊 === РЕЗУЛЬТАТЫ ЭКСПЕРИМЕНТА (Среднее время, мс) ===');
      addLog('Операция\t\t\t\tВремя (мс)');
      addLog('------------------------------------------------');
      tableData.forEach(row => {
        addLog(`${row.op.padEnd(30)}\t${row.time}`);
      });
      addLog('------------------------------------------------');
      addLog(`⛽ Средний газ: ${Math.round(avgGas)} ед.`);
      addLog('================================================');
      
      // Вывод в консоль браузера для удобного копирования
      console.table(tableData);
      console.log(`Средний газ: ${Math.round(avgGas)}`);

      setResults({
        tableData,
        avgGas: Math.round(avgGas),
        totalTx: totalIterations
      });
      
      // Генерация CSV
      const csvHeader = "Iteration,Key,Length,Gas,TimeEncrypt,TimeUpload,TimeSign,TimeConfirm,TimeDownload,TimeDecrypt\n";
      const csvRows = resultsData.map(r => 
        `${r.iteration},${r.backupKey},${r.dataLength},${r.gasUsed},${r.timeEncrypt},${r.timeUpload},${r.timeSign},${r.timeConfirm},${r.timeDownload},${r.timeDecrypt}`
      ).join('\n');
      const blob = new Blob([csvHeader + csvRows], { type: 'text/csv' });
      setCsvUrl(URL.createObjectURL(blob));

    } catch (err) {
      addLog(`❌ Краш теста: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '800px', margin: '0 auto', color: '#fff', backgroundColor: '#1e1e1e', minHeight: '100vh' }}>
      <h1>🧪 Тестирование ВКР</h1>
      
      {!isRunning && !results && (
        <button 
          onClick={handleStartTests}
          style={{ padding: '15px 30px', fontSize: '18px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', width: '100%' }}
        >
          ЗАПУСТИТЬ ТЕСТЫ (50 итераций)
        </button>
      )}

      {isRunning && (
        <div>
          <p>Идет выполнение... Пожалуйста, подтверждайте транзакции в MetaMask.</p>
          <div style={{ width: '100%', background: '#444', height: '20px', borderRadius: '10px' }}>
            <div style={{ width: `${progress}%`, background: '#4CAF50', height: '100%', borderRadius: '10px', transition: '0.3s' }}></div>
          </div>
          <p>{Math.round(progress)}%</p>
        </div>
      )}

      {results && (
        <div style={{ marginTop: '20px', padding: '20px', background: '#2d2d2d', borderRadius: '8px', border: '1px solid #4CAF50' }}>
          <h3>✅ Эксперимент завершен</h3>
          <p>Всего транзакций: {results.totalTx}</p>
          <p>Средний газ: {results.avgGas} ед.</p>
          
          <div style={{ marginTop: '15px', marginBottom: '15px' }}>
            <strong>Таблица результатов (скопирована в консоль браузера F12):</strong>
            <table style={{ width: '100%', marginTop: '10px', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #555', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Операция</th>
                  <th style={{ padding: '8px' }}>Время (мс)</th>
                </tr>
              </thead>
              <tbody>
                {results.tableData.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #333' }}>
                    <td style={{ padding: '8px' }}>{row.op}</td>
                    <td style={{ padding: '8px', fontFamily: 'monospace' }}>{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {csvUrl && (
            <a href={csvUrl} download="test-results-vkr.csv" style={{ display: 'inline-block', padding: '10px 20px', backgroundColor: '#4CAF50', color: 'white', textDecoration: 'none', borderRadius: '4px', marginRight: '10px' }}>
              📥 Скачать полный CSV
            </a>
          )}
          <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Сброс
          </button>
        </div>
      )}

      <div style={{ marginTop: '20px', maxHeight: '400px', overflowY: 'auto', border: '1px solid #444', padding: '10px', background: '#000', fontSize: '12px', fontFamily: 'monospace' }}>
        {logs.length === 0 ? 'Ожидание...' : logs.map((l, i) => (
          <div key={i} style={{ marginBottom: '4px', color: l.includes('❌') ? '#f44336' : l.includes('📊') ? '#4CAF50' : '#ccc' }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}