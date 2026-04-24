const PINATA_JWT = import.meta.env.VITE_PINATA_PROJECT_JWT;

export const uploadToIPFS = async (encryptedData) => {
  const formData = new FormData();
  const blob = new Blob([JSON.stringify(encryptedData)], { type: 'application/json' });
  formData.append('file', blob);

  try {
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Pinata upload failed: ${response.status} - ${errorData.error?.reason || 'Unknown error'}`);
    }

    const result = await response.json();
    if (!result.IpfsHash) {
      throw new Error(`No CID in response`);
    }

    return result.IpfsHash;
  } catch (err) {
    console.error('Pinata Upload Error:', err);
    throw err;
  }
};

export const getFromIPFS = async (cid) => {
  const response = await fetch(`https://gateway.pinata.cloud/ipfs/${cid}`);
  if (!response.ok) {
    throw new Error(`IPFS fetch failed: ${response.status}`);
  }
  return await response.json();
};