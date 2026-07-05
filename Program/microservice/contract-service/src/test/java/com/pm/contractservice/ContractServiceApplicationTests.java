package com.pm.contractservice;

import com.pm.contractservice.testsupport.PostgresTestContainerConfig;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest(properties = {
        "spring.sql.init.mode=never",
        "jwt.secret=MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=",
        "grpc.server.port=0"
})
@Import(PostgresTestContainerConfig.class)
class ContractServiceApplicationTests {

    @Test
    void contextLoads() {
    }

}
