package org.tege.messenger.service

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BackendClientTest {
    @Test
    fun blankServerUsesDefault() {
        assertEquals(BackendClient.DEFAULT_BASE_URL, BackendClient.normalizeBaseUrl("  "))
    }

    @Test
    fun addsHttpsAndRemovesTrailingSlash() {
        assertEquals("https://example.com", BackendClient.normalizeBaseUrl(" example.com/ "))
        assertEquals("https://example.com:8443", BackendClient.normalizeBaseUrl("HTTPS://Example.COM:8443/"))
    }

    @Test
    fun permitsCleartextOnlyForLocalDevelopment() {
        assertEquals("http://localhost:8080", BackendClient.normalizeBaseUrl("http://localhost:8080"))
        assertEquals("http://10.0.2.2:3000", BackendClient.normalizeBaseUrl("http://10.0.2.2:3000"))
        assertNull(BackendClient.normalizeBaseUrl("http://example.com"))
        assertNull(BackendClient.normalizeBaseUrl("http://192.168.1.20:8080"))
    }

    @Test
    fun rejectsLookalikeLoopbackHostsAndMalformedAddresses() {
        assertNull(BackendClient.normalizeBaseUrl("http://localhost.attacker.example"))
        assertNull(BackendClient.normalizeBaseUrl("http://127.0.0.1.attacker.example"))
        assertNull(BackendClient.normalizeBaseUrl("http://localhost:abc"))
        assertNull(BackendClient.normalizeBaseUrl("https://example.com/path"))
        assertNull(BackendClient.normalizeBaseUrl("https://example.com?token=x"))
    }

    @Test
    fun rejectsPathsCredentialsAndInvalidPorts() {
        assertNull(BackendClient.normalizeBaseUrl("https://example.com/api"))
        assertNull(BackendClient.normalizeBaseUrl("https://user:pass@example.com"))
        assertNull(BackendClient.normalizeBaseUrl("https://example.com:0"))
        assertNull(BackendClient.normalizeBaseUrl("https://example.com:65536"))
        assertNull(BackendClient.normalizeBaseUrl("https://example.com:123456"))
    }
}
