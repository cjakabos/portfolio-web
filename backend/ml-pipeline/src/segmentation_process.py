import os
import io
import sys
import logging
import pandas as pd
import numpy as np
import psycopg as pg
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sqlalchemy import create_engine
from sqlalchemy.sql import text
from scipy.optimize import linear_sum_assignment
from scipy import stats

import heapq

from config import MODEL_PATH

# Import centralized DB config instead of hardcoding credentials
from db_config import (
    get_db_connection, get_sqlalchemy_engine, get_sqlalchemy_url,
    get_psycopg_dsn
)

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)

# Spectral_r colormap colors for 5 clusters (extracted from matplotlib)
# These match plt.get_cmap("Spectral_r", 5) used in the reference
SPECTRAL_R_COLORS = {
    0: "#5e4fa2",  # Dark purple
    1: "#3288bd",  # Blue
    2: "#66c2a5",  # Teal/Green
    3: "#fdae61",  # Orange
    4: "#9e0142"   # Dark red/maroon
}


def ensure_tables_exist():
    """
    Ensure that the required tables (segment_metadata, mlinfo_raw) exist.
    Creates them if they don't exist.
    """
    with pg.connect(get_psycopg_dsn()) as conn:
        with conn.cursor() as cur:
            # Create segment_metadata table if not exists
            cur.execute("""
                CREATE TABLE IF NOT EXISTS segment_metadata (
                    segment_id integer PRIMARY KEY,
                    color text,
                    centroid_age float,
                    centroid_income float,
                    centroid_spending float
                )
            """)

            # Create mlinfo_raw table if not exists
            cur.execute("""
                CREATE TABLE IF NOT EXISTS mlinfo_raw (
                    id serial PRIMARY KEY,
                    customer_id integer,
                    pca_component_1 float,
                    pca_component_2 float,
                    segment integer
                )
            """)
        conn.commit()


def statistics(variable):
    if variable.dtype == "int64" or variable.dtype == "float64":
        return pd.DataFrame([[variable.name, np.mean(variable), np.std(variable), np.median(variable), np.var(variable)]],
                            columns = ["Variable", "Mean", "Standard Deviation", "Median", "Variance"]).set_index("Variable")
    else:
        return pd.DataFrame(variable.value_counts())

def graph_histo(x):
    if x.dtype == "int64" or x.dtype == "float64":
        # Select size of bins by getting maximum and minimum and divide the substraction by 10
        size_bins = 10
        # Get the title by getting the name of the column
        title = x.name
        #Assign random colors to each graph
        color_kde = list(map(float, np.random.rand(3,)))
        color_bar = list(map(float, np.random.rand(3,)))

        # Plot the displot
        distplot = sns.distplot(x, bins=size_bins, kde_kws={"lw": 1.5, "alpha":0.8, "color":color_kde},
                     hist_kws={"linewidth": 1.5, "edgecolor": "grey",
                               "alpha": 0.4, "color":color_bar})
        # Customize ticks and labels
        plt.xticks(size=14)
        plt.yticks(size=14);
        plt.ylabel("Frequency", size=16, labelpad=15);
        # Customize title
        plt.title(title, size=18)
        # Customize grid and axes visibility
        plt.grid(False);
        plt.gca().spines["top"].set_visible(False);
        plt.gca().spines["right"].set_visible(False);
        plt.gca().spines["bottom"].set_visible(False);
        plt.gca().spines["left"].set_visible(False);
        fig = distplot.get_figure()
        return fig
    else:
        x = pd.DataFrame(x)
        # Plot
        distplot = sns.catplot(x=x.columns[0], kind="count", palette="spring", data=x)
        # Customize title
        title = x.columns[0]
        plt.title(title, size=18)
        # Customize ticks and labels
        plt.xticks(size=14)
        plt.yticks(size=14);
        plt.xlabel("")
        plt.ylabel("Counts", size=16, labelpad=15);
        # Customize grid and axes visibility
        plt.gca().spines["top"].set_visible(False);
        plt.gca().spines["right"].set_visible(False);
        plt.gca().spines["bottom"].set_visible(False);
        plt.gca().spines["left"].set_visible(False);
        fig = distplot.get_figure()
        return fig

def find_elbow(data, theta):

    # make rotation matrix
    co = np.cos(theta)
    si = np.sin(theta)
    rotation_matrix = np.array(((co, -si), (si, co)))

    # rotate data vector
    rotated_vector = data.dot(rotation_matrix)

    # return index of elbow
    return np.where(rotated_vector == rotated_vector[:, 1].min())[0][0]

def get_data_radiant(data):
    return np.arctan2(data[:, 1].max() - data[:, 1].min(),
                  data[:, 0].max() - data[:, 0].min())


def get_previous_segment_metadata(connection):
    """
    Retrieve previous segment metadata (centroids and colors) from the database.
    Returns None if no previous metadata exists.
    Uses a separate connection to avoid transaction issues.
    """
    try:
        # Use a separate connection to check for metadata table
        # This avoids putting the main connection in a failed transaction state
        check_engine = create_engine(get_sqlalchemy_url())
        with check_engine.connect() as check_conn:
            metadata_df = pd.read_sql('select * from segment_metadata', check_conn)

        if metadata_df.empty:
            return None

        # Build a dictionary of previous centroids and colors
        previous_data = {}
        for _, row in metadata_df.iterrows():
            segment_id = int(row['segment_id'])
            previous_data[segment_id] = {
                'centroid': np.array([row['centroid_age'], row['centroid_income'], row['centroid_spending']]),
                'color': row['color']
            }
        return previous_data
    except Exception as e:
        logging.info(f"No previous segment metadata found: {e}")
        return None


def match_segments_to_previous(new_centroids, previous_metadata):
    """
    Match new cluster centroids to previous cluster centroids using the Hungarian algorithm.
    This ensures consistent segment numbering across re-segmentations.

    Args:
        new_centroids: numpy array of shape (n_clusters, n_features) with new cluster centers
        previous_metadata: dictionary with previous segment data including centroids

    Returns:
        mapping: dictionary mapping new cluster indices to previous segment IDs
        colors: dictionary mapping new cluster indices to colors
    """
    if previous_metadata is None:
        # No previous data, use default mapping with Spectral_r colors
        return {i: i for i in range(len(new_centroids))}, SPECTRAL_R_COLORS.copy()

    n_new = len(new_centroids)
    n_prev = len(previous_metadata)

    # Build previous centroids array
    prev_segment_ids = sorted(previous_metadata.keys())
    prev_centroids = np.array([previous_metadata[sid]['centroid'] for sid in prev_segment_ids])

    # Handle case where number of clusters changed
    if n_new != n_prev:
        logging.warning(f"Number of clusters changed from {n_prev} to {n_new}. Using new assignment.")
        return {i: i for i in range(n_new)}, SPECTRAL_R_COLORS.copy()

    # Compute cost matrix (distances between new and previous centroids)
    cost_matrix = np.zeros((n_new, n_prev))
    for i in range(n_new):
        for j in range(n_prev):
            cost_matrix[i, j] = np.linalg.norm(new_centroids[i] - prev_centroids[j])

    # Use Hungarian algorithm to find optimal assignment
    row_indices, col_indices = linear_sum_assignment(cost_matrix)

    # Build mapping from new cluster index to previous segment ID
    mapping = {}
    colors = {}
    for new_idx, prev_idx in zip(row_indices, col_indices):
        prev_segment_id = prev_segment_ids[prev_idx]
        mapping[new_idx] = prev_segment_id
        colors[prev_segment_id] = previous_metadata[prev_segment_id]['color']

    return mapping, colors


def save_segment_metadata(connection, centroids, colors, segment_mapping):
    """
    Save segment metadata (centroids and colors) to the database.

    Args:
        connection: database connection
        centroids: numpy array of cluster centroids (from kmeans.cluster_centers_)
        colors: dictionary mapping segment IDs to colors
        segment_mapping: dictionary mapping original cluster indices to segment IDs
    """
    with pg.connect(get_psycopg_dsn()) as conn:
        with conn.cursor() as cur:
            # Clear existing metadata
            cur.execute("DELETE FROM segment_metadata;")

            # Insert new metadata
            for original_idx, segment_id in segment_mapping.items():
                centroid = centroids[original_idx]
                color = colors.get(segment_id, SPECTRAL_R_COLORS.get(segment_id, "#808080"))
                cur.execute(
                    "INSERT INTO segment_metadata (segment_id, color, centroid_age, centroid_income, centroid_spending) VALUES (%s, %s, %s, %s, %s)",
                    (segment_id, color, float(centroid[0]), float(centroid[1]), float(centroid[2]))
                )
        conn.commit()


def save_raw_mlinfo(connection, customer_ids, pca_2d, segments):
    """
    Save raw ML info (PCA components and segments) to database for downstream visualization.

    Args:
        connection: database connection
        customer_ids: list of customer IDs
        pca_2d: numpy array of PCA-transformed data (n_samples, 2)
        segments: list of segment assignments
    """
    with pg.connect(get_psycopg_dsn()) as conn:
        with conn.cursor() as cur:
            # Create table if not exists
            cur.execute("""
                CREATE TABLE IF NOT EXISTS mlinfo_raw (
                    id serial PRIMARY KEY,
                    customer_id integer,
                    pca_component_1 float,
                    pca_component_2 float,
                    segment integer
                )
            """)

            # Clear existing data
            cur.execute("DELETE FROM mlinfo_raw;")

            # Insert new data
            for i in range(len(customer_ids)):
                cur.execute(
                    "INSERT INTO mlinfo_raw (customer_id, pca_component_1, pca_component_2, segment) VALUES (%s, %s, %s, %s)",
                    (int(customer_ids[i]), float(pca_2d[i, 0]), float(pca_2d[i, 1]), int(segments[i]))
                )
        conn.commit()


def main():

    ###  1. see if API trigger mode with DB or command line mode with csv

    # Ensure required tables exist before proceeding
    ensure_tables_exist()

    logging.info("Running in command line mode")
    # Check and read new data
    logging.info("Checking for new data")

    # First, read customers from DB
    db = get_sqlalchemy_engine()
    connection = db.connect()
    customers = pd.read_sql('select * from test', connection)
    mlinfo = pd.read_sql('select * from mlinfo', connection)

    print(customers.head())

    # Get previous segment metadata for consistent numbering
    previous_metadata = get_previous_segment_metadata(connection)
    logging.info(f"Previous segment metadata: {previous_metadata}")

    spending = customers["spending_score"]
    fig = graph_histo(spending)


    #plt.savefig('mytable.png')

    buf = io.BytesIO()
    fig.savefig(buf, format='png')
    #fig.savefig(os.path.join(MODEL_PATH, 'plot2.png'))
    buf.seek(0)
    binary2 = pg.Binary(buf.read())

    pairplot = sns.pairplot(customers, x_vars = ["age", "annual_income", "spending_score"],
                 y_vars = ["age", "annual_income", "spending_score"],
                 hue = "gender",
                 kind= "scatter",
                 palette = "YlGnBu",
                 height = 2,
                 plot_kws={"s": 35, "alpha": 0.8});

    fig = pairplot.figure

    buf = io.BytesIO()
    fig.savefig(buf, format='png')
    #fig.savefig(os.path.join(MODEL_PATH, 'plot3.png'))
    buf.seek(0)
    binary3 = pg.Binary(buf.read())

    X = customers.iloc[:, 2:5]

    print(X.head())

    # Apply PCA and fit the features selected
    pca = PCA(n_components=2).fit(X)

    # Transform samples using the PCA fit
    pca_2d = pca.transform(X)

    # Kmeans algorithm
    # n_clusters: Number of clusters. In our case 5
    # init: k-means++. Smart initialization
    # max_iter: Maximum number of iterations of the k-means algorithm for a single run
    # n_init: Number of time the k-means algorithm will be run with different centroid seeds.
    # random_state: Determines random number generation for centroid initialization.
    kmeans = KMeans(n_clusters=5, init='k-means++', max_iter=10, n_init=10, random_state=0)

    # Fit and predict
    y_means = kmeans.fit_predict(X)

    # Get new centroids
    new_centroids = kmeans.cluster_centers_

    # Match new segments to previous segments for consistent numbering
    segment_mapping, segment_colors = match_segments_to_previous(new_centroids, previous_metadata)
    logging.info(f"Segment mapping: {segment_mapping}")
    logging.info(f"Segment colors: {segment_colors}")

    # Remap cluster labels to maintain consistent segment numbers
    remapped_segments = np.array([segment_mapping[label] for label in y_means])

    # Update segments with consistent numbering and save to db
    customers['segment'] = remapped_segments


    #Make sure to clean table with DELETE from and use if_exists='append', otherwise if_exists='replace' would overwrite PRIMARY KEY
    connection.execute(text("DELETE FROM test;"))
    customers.to_sql('test', con=connection, index=False, if_exists='append')

    # Save segment metadata for future re-segmentations
    save_segment_metadata(connection, new_centroids, segment_colors, segment_mapping)

    # Save raw ML info for downstream visualization
    customer_ids = customers['id'].tolist()
    save_raw_mlinfo(connection, customer_ids, pca_2d, remapped_segments)

    #Plot segment clusters (still generate images for backwards compatibility)
    fig, ax = plt.subplots(figsize = (8, 6))

    plt.scatter(pca_2d[:, 0], pca_2d[:, 1],
                c=remapped_segments,
                edgecolor="none",
                cmap=plt.get_cmap("Spectral_r", 5),
                alpha=0.5)

    plt.gca().spines["top"].set_visible(False)
    plt.gca().spines["right"].set_visible(False)
    plt.gca().spines["bottom"].set_visible(False)
    plt.gca().spines["left"].set_visible(False)

    plt.xticks(size=12)
    plt.yticks(size=12)

    plt.xlabel("Component 1", size = 14, labelpad=10)
    plt.ylabel("Component 2", size = 14, labelpad=10)

    plt.title('Domains grouped into 5 clusters', size=16)


    plt.colorbar(ticks=[0, 1, 2, 3, 4]);

    buf = io.BytesIO()
    fig.savefig(buf, format='png')
    #fig.savefig(os.path.join(MODEL_PATH, 'plot4.png'))
    buf.seek(0)
    binary4 = pg.Binary(buf.read())



    X_new = np.array([[43, 76, 56]])

    new_customer = kmeans.predict(X_new)
    # Map the prediction to the consistent segment number
    mapped_prediction = segment_mapping[new_customer[0]]
    print(f"The new customer belongs to segment {mapped_prediction}")


    connection.commit()

    connection.close()

    # Update mlinfo (keep for backwards compatibility)
    logging.info('Updating report')
    with pg.connect(get_psycopg_dsn()) as conn:
        # Open a cursor to perform database operations
        with conn.cursor() as cur:
            cur.execute("DELETE FROM mlinfo;")
            cur.execute(
                "INSERT INTO mlinfo (id, image2, image3, image4) VALUES (%s, %s, %s, %s)",
                (1, binary2, binary3, binary4))
        conn.commit()
    conn.close()

if __name__ == '__main__':
    main()