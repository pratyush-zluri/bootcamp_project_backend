import Joi from "joi";

const new_schema = Joi.object({
    description: Joi.string().required(),
    originalAmount: Joi.number().positive().required(),
    currency: Joi.string().required(),
    date: Joi.date().iso().required()
});

const update_schema = Joi.object({
    description: Joi.string().optional(),
    originalAmount: Joi.number().optional().min(0),
    currency: Joi.string().optional(),
    date: Joi.date().iso().optional()
});

export { new_schema, update_schema };