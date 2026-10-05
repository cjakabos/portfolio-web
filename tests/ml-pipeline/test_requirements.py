import json


class TestRequirementSegmentation:
    def test_supported_samples_run_real_initialization_and_segmentation(self, client):
        for size in (10, 20, 50, 100, 200, 500):
            response = client.post("/mlops-segmentation/getMLInfo", json={"sampleSize": size})
            assert response.status_code == 200, response.get_data(as_text=True)
            data = json.loads(response.data)
            customers = json.loads(client.get("/mlops-segmentation/getSegmentationCustomers").data)
            expected = min(size, 200)  # The committed reference CSV contains 200 records.
            assert len(customers) == expected
            assert len(data["spending_histogram"]["data"]) == expected
            assert len(data["cluster_scatter"]["customer_id"]) == expected
            assert len(data["cluster_scatter"]["pca_component_1"]) == expected
            assert len(data["cluster_scatter"]["pca_component_2"]) == expected
            assert len(set(data["cluster_scatter"]["segment"])) == 5
            assert {row["id"] for row in customers} == set(data["cluster_scatter"]["customer_id"])
            assert len(data["segment_metadata"]) == 5

    def test_added_customer_is_persisted_and_included_after_real_reclustering(self, client):
        assert client.post("/mlops-segmentation/getMLInfo", json={"sampleSize": 10}).status_code == 200
        added = client.post("/mlops-segmentation/addCustomer", json={"fields": {
            "gender": "Female", "age": 42, "annual_income": 73, "spending_score": 61, "segment": 0,
        }})
        assert added.status_code == 200
        response = client.post("/mlops-segmentation/getMLInfo", json={"sampleSize": -1})
        assert response.status_code == 200, response.get_data(as_text=True)
        customers = json.loads(client.get("/mlops-segmentation/getSegmentationCustomers").data)
        assert len(customers) == 11
        added_row = next(row for row in customers if row["age"] == 42 and row["annual_income"] == 73)
        assert added_row["spending_score"] == 61
        assert added_row["segment"] in range(5)
        data = json.loads(response.data)
        assert added_row["id"] in data["cluster_scatter"]["customer_id"]
        assert len(data["spending_histogram"]["data"]) == 11
