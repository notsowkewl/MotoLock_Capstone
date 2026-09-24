package com.example.motolock.data

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import java.security.KeyFactory
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import android.util.Base64

object KeystoreHelper {
    private const val KEY_ALIAS = "MotoLockDeviceSecretKey"
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"

    private fun getOrCreateKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
        keyStore.load(null)
        
        if (keyStore.containsAlias(KEY_ALIAS)) {
            return keyStore.getKey(KEY_ALIAS, null) as SecretKey
        }
        
        val keyGenerator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEYSTORE)
        val spec = KeyGenParameterSpec.Builder(
            KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .build()
        keyGenerator.init(spec)
        return keyGenerator.generateKey()
    }

    fun isHardwareBacked(): Boolean {
        try {
            val key = getOrCreateKey()
            val factory = KeyFactory.getInstance(key.algorithm, ANDROID_KEYSTORE)
            val keyInfo: KeyInfo = factory.getKeySpec(key, KeyInfo::class.java)
            return keyInfo.isInsideSecureHardware
        } catch (e: Exception) {
            return false
        }
    }

    fun encryptSecret(secret: String): String {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey())
        val iv = cipher.iv
        val ciphertext = cipher.doFinal(secret.toByteArray(Charsets.UTF_8))
        
        val combined = ByteArray(iv.size + ciphertext.size)
        System.arraycopy(iv, 0, combined, 0, iv.size)
        System.arraycopy(ciphertext, 0, combined, iv.size, ciphertext.size)
        
        return Base64.encodeToString(combined, Base64.NO_WRAP)
    }

    fun decryptSecret(encryptedData: String): String {
        try {
            val combined = Base64.decode(encryptedData, Base64.NO_WRAP)
            val iv = ByteArray(12)
            val ciphertext = ByteArray(combined.size - 12)
            System.arraycopy(combined, 0, iv, 0, 12)
            System.arraycopy(combined, 12, ciphertext, 0, ciphertext.size)
            
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            val spec = GCMParameterSpec(128, iv)
            cipher.init(Cipher.DECRYPT_MODE, getOrCreateKey(), spec)
            
            val plaintext = cipher.doFinal(ciphertext)
            return String(plaintext, Charsets.UTF_8)
        } catch (e: Exception) {
            throw SecurityException("Failed to decrypt device secret. The key may have been corrupted or the device pairing is invalid.")
        }
    }
}
