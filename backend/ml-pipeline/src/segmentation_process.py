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

import heapq

from config import MODEL_PATH

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)
host_ip = os.getenv('DOCKER_HOST_IP', 'localhost')

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

def main():

    ###  1. see if API trigger mode with DB or command line mode with csv


    logging.info("Running in command line mode")
    # Check and read new data
    logging.info("Checking for new data")

    # First, read customers from DB
    conn_string = f"postgresql+psycopg://segmentmaster:segment@{host_ip}:5434/segmentationdb"
    db = create_engine(conn_string)
    connection = db.connect()
    customers = pd.read_sql('select * from test', connection)
    mlinfo = pd.read_sql('select * from mlinfo', connection)

    print(customers.head())

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

    # # Source: https://datascience.stackexchange.com/questions/57122/in-elbow-curve-how-to-find-the-point-from-where-the-curve-starts-to-rise
    # wcss = []
    # for i in range(1,11):
    #     km = KMeans(n_clusters=i,init='k-means++', max_iter=300, n_init=10, random_state=0)
    #     km.fit(X)
    #     wcss.append([i, km.inertia_])
    #
    # print(np.array(wcss))
    # elbow_index = find_elbow(np.array(wcss), get_data_radiant(np.array(wcss)))
    # print(elbow_index)
    #
    #
    # hp = []
    # for x, y in np.array(wcss):
    #     dist = x**2 + y**2
    #     print(dist)
    #     heapq.heappush(hp, (-dist, -x, y))
    #     if len(hp) >= 2:
    #         heapq.heappop(hp)
    #
    # res = [(-x, y) for d, x, y in hp]
    # print(res)

    # Kmeans algorithm
    # n_clusters: Number of clusters. In our case 5
    # init: k-means++. Smart initialization
    # max_iter: Maximum number of iterations of the k-means algorithm for a single run
    # n_init: Number of time the k-means algorithm will be run with different centroid seeds.
    # random_state: Determines random number generation for centroid initialization.
    kmeans = KMeans(n_clusters=5, init='k-means++', max_iter=10, n_init=10, random_state=0)

    # Fit and predict
    y_means = kmeans.fit_predict(X)


    #Update segments and save it to db
    customers['segment'] = y_means


    #Make sure to clean table with DELETE from and use if_exists='append', otherwise if_exists='replace' would overwrite PRIMARY KEY
    connection.execute(text("DELETE FROM test;"))
    customers.to_sql('test', con=connection, index=False, if_exists='append')



    #Plot segment clusters
    fig, ax = plt.subplots(figsize = (8, 6))

    plt.scatter(pca_2d[:, 0], pca_2d[:, 1],
                c=y_means,
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
    print(f"The new customer belongs to segment {new_customer[0]}")


    connection.commit()

    connection.close()

    # Update mlinfo
    print('updating report', {host_ip})
    with pg.connect(f"dbname=segmentationdb user=segmentmaster host='{host_ip}' port='5434' password='segment'") as conn:
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
