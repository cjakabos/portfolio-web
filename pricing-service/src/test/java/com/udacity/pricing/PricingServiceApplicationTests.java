package com.udacity.pricing;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.junit4.SpringRunner;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import static org.mockito.Mockito.*;
import static org.hamcrest.Matchers.*;
import org.springframework.boot.web.server.LocalServerPort;


@RunWith(SpringRunner.class)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
public class PricingServiceApplicationTests {

    @Autowired
    private MockMvc mvc;

	@LocalServerPort
	private int portNumber;

	@Test
	public void contextLoads() {
	}
	
	@Test
	public void testPriceStatus() throws Exception {
			mvc.perform(get(("http://localhost:" + portNumber + "services/price?vehicleId=1")))
					.andExpect(status().isOk());
	}
}
