export const getChallenge = (address) => `VaultBackup:${address.toLowerCase()}`;

export const getEncryptionKey = async (provider, address) => {
  const challenge = getChallenge(address);
  const signature = await provider.send('personal_sign', [challenge, address]);
  
  const { keccak256, toUtf8Bytes } = await import('ethers');
  const keyHex = keccak256(toUtf8Bytes(signature));

  const hex = keyHex.slice(2);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
};

export const encryptBackup = async (plaintext, keyBytes) => {
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  return {
    ciphertext: btoa(String.fromCharCode.apply(null, new Uint8Array(ciphertext))),
    iv: btoa(String.fromCharCode.apply(null, iv))
  };
};

export const decryptBackup = async (ciphertextB64, ivB64, keyBytes) => {
  if (!keyBytes || !(keyBytes instanceof Uint8Array)) {
    throw new Error('Invalid encryption key: must be Uint8Array');
  }

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const ciphertext = new Uint8Array([...atob(ciphertextB64)].map(c => c.charCodeAt(0)));
    const iv = new Uint8Array([...atob(ivB64)].map(c => c.charCodeAt(0)));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error('Decryption error:', err);
    throw new Error(`Decryption failed: ${err.message}`);
  }
};