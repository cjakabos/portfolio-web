import os
import sys
import logging
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.cluster import KMeans
from sklearn.decomposition import PCA


from config import INPUT_FOLDER_PATH, MODEL_PATH, PROD_DEPLOYMENT_PATH, DATA_PATH


logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)


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

    # First, read customers.csv
    customers = pd.read_csv("../customers/customers.csv")

    print(customers.head())

    spending = customers["Spending Score (1-100)"]
    fig = graph_histo(spending)


    #plt.savefig('mytable.png')

    fig.savefig(os.path.join(MODEL_PATH, 'confusionmatrix2.png'))

    pairplot = sns.pairplot(customers, x_vars = ["Age", "Annual Income (k$)", "Spending Score (1-100)"],
                 y_vars = ["Age", "Annual Income (k$)", "Spending Score (1-100)"],
                 hue = "Gender",
                 kind= "scatter",
                 palette = "YlGnBu",
                 height = 2,
                 plot_kws={"s": 35, "alpha": 0.8});

    fig = pairplot.figure
    fig.savefig(os.path.join(MODEL_PATH, 'confusionmatrix3.png'))

    X = customers.iloc[:, 2:]

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


    fig, ax = plt.subplots(figsize = (8, 6))

    plt.scatter(pca_2d[:, 0], pca_2d[:, 1],
                c=y_means,
                edgecolor="none",
                cmap=plt.cm.get_cmap("Spectral_r", 5),
                alpha=0.5)

    plt.gca().spines["top"].set_visible(False)
    plt.gca().spines["right"].set_visible(False)
    plt.gca().spines["bottom"].set_visible(False)
    plt.gca().spines["left"].set_visible(False)

    plt.xticks(size=12)
    plt.yticks(size=12)

    plt.xlabel("Component 1", size = 14, labelpad=10)
    plt.ylabel("Component 2", size = 14, labelpad=10)

    plt.title('Dominios agrupados en 5 clusters', size=16)


    plt.colorbar(ticks=[0, 1, 2, 3, 4]);

    fig.savefig(os.path.join(MODEL_PATH, 'confusionmatrix4.png'))

    X_new = np.array([[43, 76, 56]])

    new_customer = kmeans.predict(X_new)
    print(f"The new customer belongs to segment {new_customer[0]}")

if __name__ == '__main__':
    main()
