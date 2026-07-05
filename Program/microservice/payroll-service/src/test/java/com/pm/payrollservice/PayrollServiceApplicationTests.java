package com.pm.payrollservice;

import com.pm.payrollservice.testsupport.PostgresTestContainerConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest(properties = {
        "jwt.secret=MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=",
        "grpc.server.port=0"
})
@Import(PostgresTestContainerConfig.class)
class PayrollServiceApplicationTests {

    @Test
    void contextLoads() {
    }

}
