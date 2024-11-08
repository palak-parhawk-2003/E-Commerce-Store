import cloudinary from "../lib/cloudinary.js"
import { redis } from "../lib/redis.js"
import Product from "../models/product.model.js"

export const getAllProducts = async (req, res) => {
    try {
        const products = await Product.find({})
        res.json({ products })
    } catch (error) {
        console.log("Error in getAllProducts controller", error.message)
        res.status(500).json({ message: "Server error", error: error.message })
    }
}

export const getFeaturedProducts = async (req, res) => {
    try {
        let featuredProducts = await redis.get("featured_products")
        if (featuredProducts) {
            return res.json(JSON.parse(featuredProducts))
        }
        //if not found in redis, fetch from mongoDB
        featuredProducts = await Product.find({ isFeatured: true }).lean()
        //lean() -> instead of returning mongoDB document it returns a plain JS object which is good for performance
        if (!featuredProducts) {
            return res.status(404).json({ message: "No featured products found" })
        }
        await redis.set("feature_products", JSON.stringify(featuredProducts))
        res.json(featuredProducts)
    } catch (error) {
        console.log("Error in getFeaturedProducts controller", error.message)
        res.status(500).json({ message: "Server error", error: error.message })
    }
}

export const createProducts = async (req, res) => {
    try {
        const { name, description, price, image, category } = req.body
        let cloudinaryResponse = null
        if (image) {
            cloudinaryResponse = await cloudinary.uploader.upload(image, { floder: "products" })
        }
        const product = await Product.create({
            name,
            description,
            price,
            image: cloudinaryResponse?.secure_url ? cloudinaryResponse.secure_url : "",
            category
        })
        res.status(201).json(product)
    } catch (error) {
        console.log("Error in createProduct controller", error.message)
        res.status(500).json({ message: "Server error", error: error.message })
    }
}

export const deleteProducts = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
        if (!product) {
            return res.status(404).json({ message: "Product not found" })
        }
        if (product.image) {
            const publicId = product.image.split("/").pop().split(".")[0] // this will get the id of the image from cloudinary
            try {
                await cloudinary.uploader.destroy(`products/${publicId}`)
                console.log("deleted image from cloudinary")
            } catch (error) {
                console.log("error deleting image from cloudinary", error)
            }
        }
        //deleting the product from the DB
        await Product.findByIdAndDelete(req.params.id)
        res.json({ message: "Product deleted successfully" })
    } catch (error) {
        console.log("Error in deleteProduct controller", error.message)
        res.status(500).json({ message: "Server error", error: error.message })
    }
}

export const getRecommendedProducts = async (req, res) => {
    try {
        const products = await Product.aggregate([
            {
                $sample: { size: 4 } //I want 4 recommended products to be visible on the page
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    description: 1,
                    image: 1,
                    price: 1
                }
            }
        ])
        res.json(products)
    } catch (error) {
        console.log("Error in getRecommendedProducts controller", error.message)
        res.status(500).json({ message: "Server error", error: error.message })
    }
}

export const getProductsByCategory = async (req, res) => {
    const { category } = req.params;
    try {
        const products = await Product.find({ category })
        res.json({ products })
    } catch (error) {
        console.log("Error in getProductsByCategory controller", error.message)
        res.status(500).json({ message: "Server error", error: error.message })
    }
}

export const toggleFeaturedProducts = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
        if (product) {
            product.isFeatured = !product.isFeatured
            const updatedProduct = await product.save()
            await updateFeaturedProductsCache()
            res.json(updatedProduct)
        } else {
            res.status(404).json({ message: "Product not found" })
        }
    } catch (error) {
        console.log("Error in toggleFeaturedProducts controller", error.message)
        res.status(500).json({ message: "Server error", error: error.message })
    }
}

async function updateFeaturedProductsCache() {
    try {
        const featuredProducts = await Product.find({ isFeatured: true }).lean()
        await redis.set("featured_products", JSON.stringify(featuredProducts))
    } catch (error) {
        console.log("error in update cache function")
    }
}