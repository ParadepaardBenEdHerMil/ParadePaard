package com.pm.apigateway.filter;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
@ConfigurationProperties(prefix = "gateway.security")
public class GatewaySecurityProperties {

    private boolean requireHttps;
    private boolean hstsEnabled;
    private Duration hstsMaxAge = Duration.ofDays(365);

    public boolean isRequireHttps() {
        return requireHttps;
    }

    public void setRequireHttps(boolean requireHttps) {
        this.requireHttps = requireHttps;
    }

    public boolean isHstsEnabled() {
        return hstsEnabled;
    }

    public void setHstsEnabled(boolean hstsEnabled) {
        this.hstsEnabled = hstsEnabled;
    }

    public Duration getHstsMaxAge() {
        return hstsMaxAge;
    }

    public void setHstsMaxAge(Duration hstsMaxAge) {
        this.hstsMaxAge = hstsMaxAge;
    }
}
